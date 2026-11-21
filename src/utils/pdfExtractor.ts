declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: { data: ArrayBuffer | Uint8Array }) => {
        promise: Promise<{
          numPages: number;
          getPage: (pageNumber: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str: string }>;
            }>;
          }>;
        }>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

export interface InlineFileData {
  mimeType: string;
  data: string; // base64 without data: prefix
  previewUrl?: string;
}

export interface ExtractResult {
  text: string;
  pagesCount: number;
  wordCount: number;
  fileName: string;
  isImage: boolean;
  inlineData?: InlineFileData;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function extractTextFromFile(
  file: File,
  onProgress?: (status: string, percent?: number) => void
): Promise<ExtractResult> {
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Images (.png, .jpg, .jpeg, .webp, .gif) -> Direct Gemini Vision multimodal input
  if (
    file.type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)
  ) {
    onProgress?.('جاري تجهيز الصورة للتحليل عبر Gemini...', 50);
    const buffer = await file.arrayBuffer();
    const mimeType =
      file.type ||
      (extension === 'png'
        ? 'image/png'
        : extension === 'webp'
        ? 'image/webp'
        : extension === 'gif'
        ? 'image/gif'
        : 'image/jpeg');
    const base64 = arrayBufferToBase64(buffer);
    const previewUrl = URL.createObjectURL(file);

    onProgress?.('✅ تم تجهيز الصورة للتحليل عبر Gemini', 100);
    return {
      text: '',
      pagesCount: 1,
      wordCount: 0,
      fileName,
      isImage: true,
      inlineData: {
        mimeType,
        data: base64,
        previewUrl,
      },
    };
  }

  // 2. Text files (.txt, .md, .csv, .json)
  if (['txt', 'md', 'text', 'csv', 'json'].includes(extension) || file.type.startsWith('text/')) {
    onProgress?.('جاري قراءة الملف النصي...', 50);
    const text = await file.text();
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    onProgress?.('✅ تمت قراءة الملف النصي بنجاح', 100);
    return {
      text,
      pagesCount: 1,
      wordCount,
      fileName,
      isImage: false,
    };
  }

  // 3. PDF files -> Extract text via pdf.js AND attach inlineData if small/scanned
  if (extension === 'pdf' || file.type === 'application/pdf') {
    onProgress?.('جاري تهيئة قارئ ملفات PDF...', 10);
    const arrayBuffer = await file.arrayBuffer();

    let cleanedText = '';
    let totalPages = 1;

    if (window.pdfjsLib) {
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      totalPages = pdf.numPages;
      let fullText = '';

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        onProgress?.(
          `جاري قراءة صفحة ${pageNum} من ${totalPages}...`,
          Math.round((pageNum / totalPages) * 90)
        );

        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(' ');
        fullText += `\n[صفحة ${pageNum}]\n` + pageText + '\n';
      }

      cleanedText = fullText.trim();
    }

    const wordCount = cleanedText ? cleanedText.split(/\s+/).filter(Boolean).length : 0;

    // If PDF is scanned (very little selectable text) or under 10MB, attach PDF inlineData for Gemini native PDF reading
    let inlineData: InlineFileData | undefined;
    if (wordCount < 30 && file.size <= 12 * 1024 * 1024) {
      inlineData = {
        mimeType: 'application/pdf',
        data: arrayBufferToBase64(arrayBuffer),
      };
      onProgress?.(
        `✅ تم تجهيز ملف PDF (${totalPages} صفحة) للقراءة المباشرة عبر Gemini`,
        100
      );
    } else {
      onProgress?.(
        `✅ تمت قراءة ${totalPages} صفحة (${wordCount.toLocaleString()} كلمة)`,
        100
      );
    }

    return {
      text: cleanedText,
      pagesCount: totalPages,
      wordCount,
      fileName,
      isImage: false,
      inlineData,
    };
  }

  // 4. Fallback for .doc / .docx
  onProgress?.('محاولة استخراج النص من المستند...', 50);
  try {
    const rawText = await file.text();
    const printable = rawText.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (printable.length > 80) {
      const wordCount = printable.split(/\s+/).filter(Boolean).length;
      onProgress?.(`✅ تم استخراج النص (${wordCount.toLocaleString()} كلمة)`, 100);
      return {
        text: printable,
        pagesCount: 1,
        wordCount,
        fileName,
        isImage: false,
      };
    }
  } catch (err) {
    console.warn('Fallback file reading failed', err);
  }

  throw new Error('تعذر قراءة هذا المستند مباشرة. نوصي بحفظه بصيغة PDF أو TXT أو رفعه كصورة.');
}
