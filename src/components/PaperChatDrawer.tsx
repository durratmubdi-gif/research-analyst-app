import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/research';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';

interface PaperChatDrawerProps {
  researchText: string;
  paperTitle: string;
}

export const PaperChatDrawer: React.FC<PaperChatDrawerProps> = ({
  researchText,
  paperTitle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      text: `مرحباً بك! أنا المساعد الأكاديمي الذكي المخصص لبحثك "${paperTitle.slice(0, 45)}...". يمكنك سؤالي عن أي جزئية في المنهجية، صياغة شرائح العرض، استخراج اقتباسات، أو محاكاة أسئلة إضافية للمناقشة.`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'اقترح لي خطة 5 شرائح لعرض هذا البحث في مؤتمر علمي',
    'ما هي أفضل صياغة للدفاع عن حجم العينة أمام اللجنة؟',
    'استخرج لي أهم 3 اقتباسات قوية تدعم أطروحة البحث',
    'اقترح 3 عناوين لأبحاث مستقبلية مبنية على هذه النتائج',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (qText?: string) => {
    const questionToSend = qText || inputQuestion.trim();
    if (!questionToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: questionToSend,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchText,
          question: questionToSend,
          history: messages.slice(-4).map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشلت معالجة السؤال');
      }

      const botMsg: ChatMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        text: data.reply || 'لم يتم استلام رد.',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        text: 'عذراً، حدث خطأ أثناء الإجابة: ' + error.message,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden no-print">
      {/* Drawer Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-right hover:bg-slate-50 transition bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
            <Bot className="w-5 h-5 text-teal-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg">
                اسأل الباحث الذكي عن هذا البحث
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-400 text-slate-950">
                Gemini 4 Chat
              </span>
            </div>
            <p className="text-xs text-slate-300">
              حاور الذكاء الاصطناعي حول تفاصيل دراستك، اطلب تدقيقاً إضافياً، أو صيغ شرائح العرض
            </p>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-white/10 text-white">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Expanded Chat Body */}
      {isOpen && (
        <div className="flex flex-col h-[460px] bg-slate-50/50">
          {/* Quick suggestions */}
          <div className="p-3 bg-white border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              مقترحات سريعة:
            </span>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 border border-slate-200 shrink-0 transition"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-2xs whitespace-pre-line'
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`block text-[10px] mt-1.5 ${
                      m.role === 'user' ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200 w-fit">
                <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span>جاري استقراء البحث وصياغة الإجابة الأكاديمية...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="اسأل أي سؤال تحليلي حول هذا البحث..."
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={isLoading || !inputQuestion.trim()}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-teal-900 disabled:opacity-40 text-white font-bold transition flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
