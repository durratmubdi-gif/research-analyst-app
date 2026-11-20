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

export interface ExtractResult {
  text: string;
  pagesCount: number;
  wordCount: number;
  fileName: string;
}

export async function extractTextFromFile(
  file: File,
  onProgress?: (status: string, percent?: number) => void
): Promise<ExtractResult> {
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Text files (.txt, .md, .csv, .json)
  if (['txt', 'md', 'text', 'csv', 'json'].includes(extension) || file.type.startsWith('text/')) {
    onProgress?.('جاري قراءة الملف النصي...', 50);
    const text = await file.text();
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    onProgress?.('تمت القراءة بنجاح', 100);
    return {
      text,
      pagesCount: 1,
      wordCount,
      fileName,
    };
  }

  // 2. PDF files
  if (extension === 'pdf' || file.type === 'application/pdf') {
    onProgress?.('جاري تهيئة قارئ ملفات PDF...', 10);
    const arrayBuffer = await file.arrayBuffer();

    if (!window.pdfjsLib) {
      throw new Error('مكتبة قراءة PDF غير جاهزة، يرجى المحاولة بعد قليل أو نسخ النص يدوياً');
    }

    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
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

    const cleanedText = fullText.trim();
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    onProgress?.(`تمت قراءة ${totalPages} صفحة بنجاح (${wordCount} كلمة)`, 100);

    return {
      text: cleanedText,
      pagesCount: totalPages,
      wordCount,
      fileName,
    };
  }

  // 3. Fallback for Word (.docx) or other formats
  // Simple plain text extraction attempt
  onProgress?.('محاولة استخراج النص من الملف...', 50);
  try {
    const text = await file.text();
    // Filter printable text if possible
    const printable = text.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ');
    if (printable.length > 100) {
      const wordCount = printable.trim().split(/\s+/).filter(Boolean).length;
      return {
        text: printable,
        pagesCount: 1,
        wordCount,
        fileName,
      };
    }
  } catch (err) {
    console.warn('Fallback file reading failed', err);
  }

  throw new Error('نوع الملف غير مدعوم مباشرة. نوصي بتحويل المستند إلى PDF أو نسخ النص ولصقه في خانة اللصق.');
}
