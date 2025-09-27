import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, BookOpen, GraduationCap, Users, X, ChevronLeft, Search, ChevronRight, CreditCard, IndianRupee, Plus, FileText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import { Badge } from "@/components/ui/badge";
import CreatedPapers from "./CreatedPapers";

// OTP cooldown (in milliseconds)
const OTP_COOLDOWN_MS = 60_000;

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Board {
  id: number;
  name: string;
  description: string;
  language?: string;
}

interface Standard {
  id: number;
  name: string;
  boardId: number;
}

interface Subject {
  id?: number;
  name: string;
  price?: number;
}

interface Question {
  id: number;
  question: string;
  type: string;
  difficulty: string;
  chapter: string;
  marks: number;
  text?: string;
  content?: string;
}

interface Chapter {
  id: number;
  name: string;
  subjectId: number;
}

const StudentPortal = () => {
  const [currentStep, setCurrentStep] = useState("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | string[] | null>(null);
  const [selectedQuestionType, setSelectedQuestionType] = useState<string | null>(null);
  const [paperMode, setPaperMode] = useState<string | null>(null);
  const [showBoardsPopup, setShowBoardsPopup] = useState(false);
  const [showStandardsPopup, setShowStandardsPopup] = useState(false);

  // API data from admin panel
  const [boards, setBoards] = useState<Board[]>([]);
  const [standards, setStandards] = useState<Record<number, Standard[]>>({});
  const [subjects, setSubjects] = useState<Record<number, Subject[]>>({});
  const [questions, setQuestions] = useState<Record<number, Question[]>>({});
  const [chapterQuestions, setChapterQuestions] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [selectedChapterNames, setSelectedChapterNames] = useState<string[]>([]);
  const [multiChapterLoading, setMultiChapterLoading] = useState(false);

  // Editable paper header fields
  const [examTitle, setExamTitle] = useState("Question Paper");
  const [schoolName, setSchoolName] = useState("");
  const [examDuration, setExamDuration] = useState("2 Hours");
  const [examInstructions, setExamInstructions] = useState("Answer all questions.");
  const [pdfFontReady, setPdfFontReady] = useState(false);

  const { toast } = useToast();

  // Base URLs for services
  const OTP_BASE_URL = "https://08m8v685-3000.inc1.devtunnels.ms";
  const ADMIN_BASE_URL = "https://08m8v685-3002.inc1.devtunnels.ms";

  // Function to save paper to localStorage
  const savePaperToStorage = (paperData: {
    title: string;
    subject: string;
    board: string;
    standard: string;
    type: string;
    difficulty?: string;
    chapters?: string[];
    totalQuestions: number;
    totalMarks: number;
    pdfBlob?: Blob;
    pdfUrl?: string;
  }) => {
    try {
      const savedPapers = JSON.parse(localStorage.getItem('createdPapers') || '[]');
      const newPaper = {
        id: Date.now().toString(),
        ...paperData,
        createdAt: new Date().toISOString(),
      };
      savedPapers.push(newPaper);
      localStorage.setItem('createdPapers', JSON.stringify(savedPapers));
      toast({
        title: "Paper Saved",
        description: "Your paper has been saved successfully!",
      });
    } catch (error) {
      console.error('Error saving paper:', error);
      toast({
        title: "Error",
        description: "Failed to save paper. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to get all subjects from all standards
  const getAllSubjects = () => {
    const allSubjects: Subject[] = [];
    Object.values(subjects).forEach(standardSubjects => {
      if (Array.isArray(standardSubjects)) {
        allSubjects.push(...standardSubjects);
      }
    });
    return allSubjects;
  };

  // Function to load subjects for selected standard
  const loadSubjectsForStandard = async (standardId: number) => {
    setLoadingBoards(true);
    
    try {
      const response = await fetch(`${ADMIN_BASE_URL}/api/standards/${standardId}/subjects`);
      if (response.ok) {
        const subjectsData = await response.json();
        setSubjects(prev => ({ ...prev, [standardId]: subjectsData }));
        console.log(`Loaded subjects for standard ${standardId}:`, subjectsData);
      } else {
        // Use fallback subjects if API fails
        const fallbackSubjects = [
          { name: "Mathematics", price: 0 },
          { name: "Science", price: 0 },
          { name: "English", price: 0 },
          { name: "Social Studies", price: 0 },
          { name: "Hindi", price: 0 },
          { name: "Physics", price: 0 },
          { name: "Chemistry", price: 0 },
          { name: "Biology", price: 0 },
        ];
        setSubjects(prev => ({ ...prev, [standardId]: fallbackSubjects }));
        console.log(`Using fallback subjects for standard ${standardId}`);
      }
    } catch (error) {
      console.error(`Error loading subjects for standard ${standardId}:`, error);
      // Use fallback subjects on error
      const fallbackSubjects = [
        { name: "Mathematics", price: 0 },
        { name: "Science", price: 0 },
        { name: "English", price: 0 },
        { name: "Social Studies", price: 0 },
        { name: "Hindi", price: 0 },
        { name: "Physics", price: 0 },
        { name: "Chemistry", price: 0 },
        { name: "Biology", price: 0 },
      ];
      setSubjects(prev => ({ ...prev, [standardId]: fallbackSubjects }));
    } finally {
      setLoadingBoards(false);
    }
  };

  const [subjectQuery, setSubjectQuery] = useState("");
  const [boardQuery, setBoardQuery] = useState("");
  const [standardQuery, setStandardQuery] = useState("");
  const [chapterQuery, setChapterQuery] = useState("");
  const [targetTotalMarks, setTargetTotalMarks] = useState<number>(50);
  // Chapter-mode now generates PDF with all questions from selected chapters
  
  // Payment related state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Custom paper builder state
  type CustomQuestionItem = { id: string; text: string; marks: number };
  type CustomSubsection = { id: string; title: string; questions: CustomQuestionItem[] };
  type CustomSection = { id: string; title: string; subsections: CustomSubsection[] };
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [pickerSubId, setPickerSubId] = useState<string | null>(null);
  const [pickerChapter, setPickerChapter] = useState<string>("");
  const [pickerLoading, setPickerLoading] = useState<boolean>(false);
  const [pickerQuestions, setPickerQuestions] = useState<Question[]>([]);
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set());
  
  // Reset payment loading state when modal opens
  useEffect(() => {
    if (showPaymentModal) {
      setPaymentLoading(false); // Reset loading state when modal opens
    }
  }, [showPaymentModal]);

  // Load Unicode font for PDFs (e.g., Gujarati)
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // btoa may fail for large inputs; split into chunks
    const chunkSize = 0x8000;
    let base64 = '';
    for (let i = 0; i < binary.length; i += chunkSize) {
      base64 += btoa(binary.slice(i, i + chunkSize));
    }
    return base64;
  };

  const ensurePdfUnicodeFont = async (doc: jsPDF) => {
    if (pdfFontReady) {
      try { doc.setFont('NotoSansGujarati'); } catch {}
      return;
    }
    try {
      const res = await fetch('/fonts/NotoSansGujarati-Regular.ttf');
      if (!res.ok) throw new Error('Font not found');
      const buf = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      doc.addFileToVFS('NotoSansGujarati-Regular.ttf', base64);
      doc.addFont('NotoSansGujarati-Regular.ttf', 'NotoSansGujarati', 'normal');
      doc.setFont('NotoSansGujarati');
      setPdfFontReady(true);
    } catch (e) {
      console.warn('Unicode font load failed, falling back to HTML renderer for complex scripts.', e);
    }
  };

  const containsComplexScript = (text: string) => /[\u0A80-\u0AFF\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/.test(text);

  const generatePDFViaHTML = async () => {
    // Build hidden container
    const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

    // Build two sections: A = MCQ, B = Others (ascending marks)
    const sectionLabel = (idx: number) => String.fromCharCode('A'.charCodeAt(0) + idx);
    const makeSectionHTML = () => {
      let qNumber = 1;
      if (customSections.length > 0) {
        const nonEmptySections = customSections.filter(sec => sec.subsections.some(sub => sub.questions.length > 0));
        return nonEmptySections.map((sec, sidx) => {
          const title = `Section ${String.fromCharCode('A'.charCodeAt(0) + sidx)}: ${sec.title || '-'}`;
          const subs = sec.subsections.filter(sub => sub.questions.length > 0).map(sub => {
            const items = sub.questions.map(q => {
              const qText = q.text || '[No question text]';
              const marks = Number.isFinite(q.marks) ? q.marks : '-';
              return `
                <div style=\"padding-bottom:8px; border-bottom:1px dashed #e5e5e5;\">\
                  <div style=\"display:flex; align-items:flex-start; gap:10px;\">\
                    <div style=\"min-width:26px; font-weight:700;\">Q${qNumber++}.</div>
                    <div style=\"flex:1; line-height:1.5; font-size:13px;\">${qText}</div>
                    <div style=\"margin-left:8px; font-size:11px; background:#efefef; border:1px solid #ddd; padding:2px 8px; border-radius:12px; white-space:nowrap;\">${marks} Marks</div>
                  </div>
                </div>`;
            }).join('');
            return `
              <div style=\"margin-top:10px;\">\
                <div style=\"font-weight:600; font-size:13px;\">${sub.title || '-'}</div>
                ${items}
              </div>`;
          }).join('');
          return `
            <div style=\"margin-top:14px;\">\
              <div style=\"font-weight:700; font-size:14px; border-left:4px solid #222; padding-left:8px;\">${title}</div>
              ${subs}
            </div>`;
        }).join('');
      }

      const withCt = selectedQuestions.map(q => ({ ...q, _ct: canonicalType(q.type) }));
      const mcqs = withCt.filter(q => q._ct === 'MCQ');
      const others = withCt.filter(q => q._ct !== 'MCQ').sort((a, b) => (a.marks || 0) - (b.marks || 0));
      const rawSections = [
        { key: 'MCQ' as const, items: mcqs },
        { key: 'Others' as const, items: others },
      ];
      const nonEmpty = rawSections.filter(s => s.items.length > 0);
      return nonEmpty.map((sec, idx) => {
        const title = `Section ${String.fromCharCode('A'.charCodeAt(0) + idx)}: ${sec.key}`;
        const items = sec.items.map(q => {
          const qText = q.question || (q as any).text || (q as any).content || '[No question text]';
          const marks = Number.isFinite(q.marks) ? q.marks : '-';
          const html = `
            <div style=\"padding-bottom:8px; border-bottom:1px dashed #e5e5e5;\">\
              <div style=\"display:flex; align-items:flex-start; gap:10px;\">\
                <div style=\"min-width:26px; font-weight:700;\">Q${qNumber++}.</div>
                <div style=\"flex:1; line-height:1.5; font-size:13px;\">${qText}</div>
                <div style=\"margin-left:8px; font-size:11px; background:#efefef; border:1px solid #ddd; padding:2px 8px; border-radius:12px; white-space:nowrap;\">${marks} Marks</div>
              </div>
            </div>`;
          return html;
        }).join('');
        return `
          <div style=\"margin-top:14px;\">\
            <div style=\"font-weight:700; font-size:14px; border-left:4px solid #222; padding-left:8px;\">${title}</div>
            ${items}
          </div>`;
      }).join('');
    };

    // Marks distribution chips (group by identical marks)
    const marksGroupsMap = new Map<number, number>();
    selectedQuestions.forEach(q => {
      const m = Number.isFinite(q.marks) ? Number(q.marks) : 0;
      marksGroupsMap.set(m, (marksGroupsMap.get(m) || 0) + 1);
    });
    const marksGroups = Array.from(marksGroupsMap.entries())
      .filter(([m]) => m > 0)
      .sort((a, b) => a[0] - b[0]);
    const marksChips = marksGroups
      .map(([m, c]) => `<span style=\"display:inline-block; padding:2px 10px; border:1px solid #ddd; background:#f6f6f6; border-radius:999px; font-size:11px; margin-right:8px; margin-bottom:6px;\">${m}-mark × ${c}</span>`)
      .join('');

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.style.color = '#000000';
    container.style.fontFamily = "'Noto Sans Gujarati','Noto Sans',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
    container.innerHTML = `
      <div style="padding:28px;">
        <div style="text-align:center; font-weight:800; font-size:22px; letter-spacing:.2px;">${examTitle || 'Question Paper'}</div>
        <div style="margin-top:8px; display:flex; justify-content:center; gap:18px; font-size:12px;">
          <div>School: ${schoolName || '-'}</div>
          <div>Board: ${selectedBoard?.name || '-'}</div>
          <div>Standard: ${selectedStandard?.name || '-'}</div>
          <div>Subject: ${selectedSubject?.name || '-'}</div>
          <div>Duration: ${examDuration || '-'}</div>
          <div>Total Marks: ${totalMarks}</div>
        </div>
        <div style="margin-top:10px; height:1px; background:#222;"></div>
        ${examInstructions ? `<div style=\"margin-top:12px; font-size:12px; border:1px solid #ddd; padding:10px; border-radius:6px; background:#fafafa;\"><strong>Instructions:</strong> ${examInstructions}</div>` : ''}
        ${marksGroups.length ? `<div style=\"margin-top:10px; font-size:12px;\"><strong>Marks Distribution:</strong><div style=\"margin-top:6px;\">${marksChips}</div></div>` : ''}
        ${makeSectionHTML()}
      </div>
    `;
    document.body.appendChild(container);

    const saveAndCleanup = (pdf: jsPDF) => {
      const fileName = `${selectedSubject?.name || 'Subject'}_${selectedChapter || 'All'}_Question_Paper.pdf`;
      pdf.save(fileName);
      
      // Save paper to localStorage
      const paperData = {
        title: examTitle || 'Question Paper',
        subject: selectedSubject?.name || '',
        board: selectedBoard?.name || 'General',
        standard: selectedStandard?.name || 'General',
        type: paperMode || 'Custom',
        difficulty: selectedQuestionType || undefined,
        chapters: selectedChapterNames.length > 0 ? selectedChapterNames : undefined,
        totalQuestions: selectedQuestions.length,
        totalMarks: selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0),
      };
      savePaperToStorage(paperData);
      
      if (container.parentNode) container.parentNode.removeChild(container);
      toast({ title: 'PDF Downloaded', description: `Question paper saved as ${fileName}` });
    };

    // Ensure html2canvas is available
    const ensureHtml2Canvas = async (): Promise<any> => {
      const w = window as any;
      if (w.html2canvas) return w.html2canvas;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load html2canvas'));
        document.body.appendChild(s);
      });
      return (window as any).html2canvas;
    };

    try {
      const html2canvas = await ensureHtml2Canvas();
      // Use a modest scale to avoid memory issues and blank renders
      const canvas = await html2canvas(container, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
      const imgWidthPt = 595.28; // A4 width in pt for jsPDF default (unit=pt)
      const imgHeightPt = 841.89; // A4 height in pt
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });

      // Calculate pixel-to-point ratio
      const ratio = imgWidthPt / canvas.width;
      const pagePixelHeight = imgHeightPt / ratio - 60; // leave footer space for page number

      const totalPages = Math.ceil(canvas.height / pagePixelHeight);

      const pageCanvas = document.createElement('canvas');
      const pageCtx = pageCanvas.getContext('2d');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pagePixelHeight, canvas.height);

      for (let page = 0; page < totalPages; page++) {
        const sy = Math.floor(page * pagePixelHeight);
        const sh = Math.min(pagePixelHeight, canvas.height - sy);
        pageCanvas.height = sh;
        pageCtx!.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx!.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, pageCanvas.width, pageCanvas.height);
        const imgData = pageCanvas.toDataURL('image/png', 1.0);
        if (page > 0) pdf.addPage();
        const left = 40; const right = imgWidthPt - 40; const usableWidth = right - left;
        const h = (usableWidth / pageCanvas.width) * pageCanvas.height;
        pdf.addImage(imgData, 'PNG', left, 30, usableWidth, h);
        // Footer page number
        const footerY = imgHeightPt - 24;
        pdf.setFontSize(10);
        pdf.text(`Page ${page + 1} of ${totalPages}`, imgWidthPt / 2, footerY, { align: 'center' });
      }

      saveAndCleanup(pdf);
    } catch (e) {
      if (container.parentNode) container.parentNode.removeChild(container);
      console.error('PDF render failed', e);
      toast({ title: 'PDF failed', description: 'Unable to render PDF. Please try again.' });
    }
  };

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          setRazorpayLoaded(true);
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          setRazorpayLoaded(true);
          resolve(true);
        };
        script.onerror = () => {
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    loadRazorpayScript();
  }, []);

  // Extract readable question text from many potential fields
  const getQuestionText = (raw: any): string => {
    if (!raw) return "";
    const directCandidates = [
      raw.question,
      raw.text,
      raw.content,
      raw.title,
      raw.name,
      raw.body,
      raw.prompt,
      raw.statement,
      raw.description,
      raw.questionText,
      raw.question_text,
      raw.ques,
      raw.que,
    ];

    for (const c of directCandidates) {
      if (typeof c === "string" && c.trim()) {
        return c.trim();
      }
    }

    // Look into a nested question field if present
    if (raw.question && typeof raw.question === "object") {
      const nested = getQuestionText(raw.question);
      if (nested) return nested;
    }

    // As a last resort, pick the first string-like value in the object
    for (const val of Object.values(raw)) {
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }

    return "";
  };

  // Normalize questions coming from various API shapes
  const normalizeQuestion = (raw: any): Question => {
    const questionText = getQuestionText(raw);
    const normalized: Question = {
      id: raw?.id ?? raw?._id ?? Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`),
      question: questionText,
      type: raw?.type ?? raw?.question_type ?? raw?.format ?? "-",
      difficulty: raw?.difficulty ?? raw?.level ?? "-",
      chapter: raw?.chapter?.name ?? raw?.chapter ?? raw?.chapterName ?? "-",
      marks: Number(raw?.marks ?? raw?.score ?? raw?.points ?? 0),
      text: raw?.text,
      content: raw?.content,
    };
    return normalized;
  };

  // Auto-bypass OTP if previously verified on this browser
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("spg_logged_in_email");
      if (savedEmail) {
        setEmail(savedEmail);
        // Try restore board and standard; if present, skip directly to subjects
        const boardRaw = localStorage.getItem("spg_selected_board");
        const standardRaw = localStorage.getItem("spg_selected_standard");
        if (boardRaw && standardRaw) {
          try {
            const board = JSON.parse(boardRaw);
            const standard = JSON.parse(standardRaw);
            setSelectedBoard(board);
            setSelectedStandard(standard);
            setCurrentStep("subjects");
            toast({ title: "Welcome back", description: "Restored your board and standard." });
          } catch {
            setCurrentStep("main-menu");
            toast({ title: "Welcome back", description: "Logged in from previous session." });
          }
        } else {
          setCurrentStep("main-menu");
          toast({ title: "Welcome back", description: "Logged in from previous session." });
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Payment functions
  const initiatePayment = async (subject: Subject) => {
    if (!razorpayLoaded) {
      toast({ title: "Payment Error", description: "Payment system is not ready. Please try again." });
      return;
    }

    setPaymentLoading(true);
    try {
      console.log('Creating payment order for:', subject);
      
      // Create order on your backend
      const orderResponse = await fetch('https://08m8v685-3002.inc1.devtunnels.ms/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: (subject.price || 0) * 100, // Convert to paise
          currency: 'INR',
          subjectId: subject.id,
          subjectName: subject.name,
          userEmail: email,
        }),
      });

      console.log('Order response status:', orderResponse.status);
      console.log('Order response headers:', Object.fromEntries(orderResponse.headers.entries()));

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('Order creation failed:', errorText);
        throw new Error(`Failed to create payment order: ${orderResponse.status} - ${errorText}`);
      }

      // Check if response is JSON
      const contentType = orderResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await orderResponse.text();
        console.error('Non-JSON response received:', responseText);
        throw new Error('Server returned HTML instead of JSON. API endpoint may not exist.');
      }

      const orderData = await orderResponse.json();
      console.log('Order data received:', orderData);

      // For now, let's use a test Razorpay key and create a simple order
      const options = {
        key: 'rzp_test_1DP5mmOlF5G5ag', // Test Razorpay key - replace with your actual key
        amount: (subject.price || 0) * 100, // Convert to paise
        currency: 'INR',
        name: 'Study Path Genie',
        description: `Payment for ${subject.name}`,
        order_id: orderData.id || `order_${Date.now()}`, // Use order ID from backend or create one
        // Add receipt for testing
        receipt: `receipt_${subject.id}_${Date.now()}`,
        handler: async function (response: any) {
          console.log('Payment successful:', response);
          
          try {
            // Verify payment on your backend
            const verifyResponse = await fetch('https://08m8v685-3002.inc1.devtunnels.ms/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                subjectId: subject.id,
                userEmail: email,
              }),
            });

            if (verifyResponse.ok) {
              toast({ title: "Payment Successful", description: `Access granted to ${subject.name}` });
              setShowPaymentModal(false);
              // Proceed to subject selection
              setSelectedSubject(subject);
              setCurrentStep("paper-options");
            } else {
              const errorText = await verifyResponse.text();
              console.error('Payment verification failed:', errorText);
              toast({ title: "Payment Verification Failed", description: "Please contact support." });
            }
          } catch (verifyError) {
            console.error('Payment verification error:', verifyError);
            toast({ title: "Payment Verification Error", description: "Please contact support." });
          }
        },
        prefill: {
          email: email,
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: function() {
            console.log('Payment modal dismissed');
            setPaymentLoading(false);
          }
        }
      };

      console.log('Opening Razorpay with options:', options);
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      console.error('Payment error:', error);
      
      // If API fails, offer fallback payment option
      if (error instanceof Error && error.message.includes('API endpoint may not exist')) {
        toast({ 
          title: "API Not Available", 
          description: "Backend API is not available. Using test payment mode.",
          duration: 5000
        });
        
        // Fallback: Create payment without backend API
        try {
          const options = {
            key: 'rzp_test_1DP5mmOlF5G5ag', // Test Razorpay key
            amount: (subject.price || 0) * 100,
            currency: 'INR',
            name: 'Study Path Genie',
            description: `Payment for ${subject.name}`,
            order_id: `order_${Date.now()}`,
            receipt: `receipt_${subject.id}_${Date.now()}`,
            handler: function (response: any) {
              console.log('Fallback payment successful:', response);
              toast({ title: "Payment Successful", description: `Access granted to ${subject.name}` });
              setShowPaymentModal(false);
              setSelectedSubject(subject);
              setCurrentStep("paper-options");
            },
            prefill: {
              email: email,
            },
            theme: {
              color: '#3B82F6',
            },
            modal: {
              ondismiss: function() {
                console.log('Payment modal dismissed');
                setPaymentLoading(false);
              }
            }
          };

          const razorpay = new window.Razorpay(options);
          razorpay.open();
          return; // Exit early to avoid setting loading to false
        } catch (fallbackError) {
          console.error('Fallback payment error:', fallbackError);
        }
      }
      
      toast({ 
        title: "Payment Error", 
        description: error instanceof Error ? error.message : "Failed to initiate payment. Please try again." 
      });
      setPaymentLoading(false);
    }
  };

  const handleSubjectSelection = (subject: Subject) => {
    if (subject.price && subject.price > 0) {
      setPaymentLoading(false); // Reset loading state
      setShowPaymentModal(true);
      // Store the subject for after payment
      setSelectedSubject(subject);
    } else {
      // Free subject, proceed directly
      setSelectedSubject(subject);
      setCurrentStep("paper-options");
    }
  };

  const handlePayButtonClick = () => {
    if (selectedSubject) {
      initiatePayment(selectedSubject);
    }
  };

  // PDF Generation function
  const generatePDF = async () => {
    const fullText = [
      examTitle,
      schoolName,
      selectedBoard?.name || '',
      selectedStandard?.name || '',
      selectedSubject?.name || '',
      examInstructions,
      ...selectedQuestions.map(q => q.question || (q as any).text || (q as any).content || '')
    ].join(' ');

    if (containsComplexScript(fullText)) {
      await generatePDFViaHTML();
      return;
    }

    const doc = new jsPDF();

    await ensurePdfUnicodeFont(doc);

    // Header Layout
    doc.setFontSize(16);
    doc.text(examTitle || 'Question Paper', 105, 18, { align: 'center' });

    doc.setFontSize(11);
    const headerLines = [
      schoolName ? `School: ${schoolName}` : null,
      selectedBoard?.name ? `Board: ${selectedBoard?.name}` : null,
      selectedStandard?.name ? `Standard: ${selectedStandard?.name}` : null,
      selectedSubject?.name ? `Subject: ${selectedSubject?.name}` : null,
      examDuration ? `Duration: ${examDuration}` : null,
    ].filter(Boolean) as string[];

    let y = 26;
    headerLines.forEach((line) => {
      doc.text(line, 105, y, { align: 'center' });
      y += 6;
    });

    // Instructions box
    if (examInstructions) {
      const maxWidth = 170;
      const split = doc.splitTextToSize(`Instructions: ${examInstructions}`, maxWidth);
      doc.setFontSize(10);
      doc.text(split, 20, y);
      y += split.length * 5 + 6;
    }

    const writeSectionPdf = (title: string, items: any[]) => {
      if (items.length === 0) return;
      doc.setFontSize(12);
      doc.text(title, 20, y);
      y += 8;
      items.forEach((question, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
          try { doc.setFont('NotoSansGujarati'); } catch {}
        }
        const qText = question.question || (question as any).text || (question as any).content || "[No question text]";
        const split = doc.splitTextToSize(`Q${idx + 1}. ${qText}`, 170);
        doc.text(split, 20, y);
        y += split.length * 6;
        doc.setFontSize(9);
        doc.text(`Marks: ${question.marks ?? '-' } • Difficulty: ${question.difficulty ?? '-' } • Type: ${question.type ?? '-' }`, 20, y);
        y += 10;
        doc.setFontSize(12);
      });
      y += 6;
    };

    if (customSections.length > 0) {
      const nonEmptySections = customSections.filter(sec => sec.subsections.some(sub => sub.questions.length > 0));
      nonEmptySections.forEach((sec, sidx) => {
        const title = `Section ${String.fromCharCode(65 + sidx)}: ${sec.title || '-'}`;
        const items = sec.subsections.flatMap(sub => sub.questions.map(q => ({
          question: q.text,
          marks: q.marks,
          difficulty: '-',
          type: sub.title || '-'
        })));
        writeSectionPdf(title, items);
      });
    } else {
      // Two sections: A = MCQ, B = Others (ascending marks)
      const withCtForPdf = selectedQuestions.map(q => ({ ...q, _ct: canonicalType(q.type) }));
      const sectionA = withCtForPdf.filter(q => q._ct === 'MCQ');
      const sectionB = withCtForPdf.filter(q => q._ct !== 'MCQ').sort((a, b) => (a.marks || 0) - (b.marks || 0));
      const pdfSections: { title: string; items: any[] }[] = [];
      if (sectionA.length > 0) pdfSections.push({ title: 'Section A: MCQ', items: sectionA });
      if (sectionB.length > 0) pdfSections.push({ title: pdfSections.length === 0 ? 'Section A: Others' : 'Section B: Others', items: sectionB });
      pdfSections.forEach(s => writeSectionPdf(s.title, s.items));
    }

    const chapterPart = Array.isArray(selectedChapter) ? selectedChapter.join('-') : (selectedChapter || 'All');
    const fileName = `${selectedSubject?.name || 'Subject'}_${chapterPart}_Question_Paper.pdf`;
    doc.save(fileName);

    // Save paper to localStorage
    const paperData = {
      title: examTitle || 'Question Paper',
      subject: selectedSubject?.name || '',
      board: selectedBoard?.name || 'General',
      standard: selectedStandard?.name || 'General',
      type: paperMode || 'Custom',
      difficulty: selectedQuestionType || undefined,
      chapters: selectedChapterNames.length > 0 ? selectedChapterNames : undefined,
      totalQuestions: selectedQuestions.length,
      totalMarks: selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0),
    };
    savePaperToStorage(paperData);

    toast({
      title: "PDF Downloaded",
      description: `Question paper saved as ${fileName}`,
    });
  };

  // Helper to normalize question objects from API to our shape (deduped)

  const canonicalType = (t: string | undefined | null): 'MCQ' | 'Short' | 'Long' | '-' => {
    const s = (t || '-').toLowerCase();
    if (s.includes('mcq') || s.includes('multiple') || s.includes('objective') || s === 'mcq') return 'MCQ';
    if (s.includes('short')) return 'Short';
    if (s.includes('long') || s.includes('descriptive')) return 'Long';
    return '-';
  };

  // no per-type picking for chapter mode

  // Fetch boards from admin panel
  const fetchBoards = async () => {
    setLoadingBoards(true);
    try {
      const response = await fetch(`${ADMIN_BASE_URL}/api/boards`);
      if (!response.ok) {
        throw new Error("Failed to fetch boards");
      }
      const boardsData = await response.json();
      setBoards(boardsData);
    } catch (err) {
      console.error("Error fetching boards:", err);
      setError("Failed to load boards. Please try again.");
      // Fallback to mock data if API fails
      setBoards([
        { id: 1, name: "CBSE", description: "Central Board of Secondary Education" },
        { id: 2, name: "ICSE", description: "Indian Certificate of Secondary Education" },
        { id: 3, name: "State Board", description: "State Board Education" },
        { id: 4, name: "IB", description: "International Baccalaureate" },
      ]);
    } finally {
      setLoadingBoards(false);
    }
  };

  // Fetch standards for selected board
  const fetchStandards = async (boardId: number) => {
    try {
      const response = await fetch(
        `${ADMIN_BASE_URL}/api/boards/${boardId}/standards`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch standards");
      }
      const standardsData = await response.json();
      setStandards((prev) => ({
        ...prev,
        [boardId]: standardsData,
      }));
    } catch (err) {
      console.error("Error fetching standards:", err);
      // Fallback to mock data if API fails
      setStandards((prev) => ({
        ...prev,
        [boardId]: [
          { id: 1, name: "Class 10", boardId: boardId },
          { id: 2, name: "Class 11", boardId: boardId },
          { id: 3, name: "Class 12", boardId: boardId },
        ],
      }));
    }
  };

  // Fetch subjects for selected standard
  const fetchSubjects = async (standardId: number) => {
    setError("");
    try {
      console.log("Fetching subjects for standard:", standardId);
      const response = await fetch(
        `https://08m8v685-3002.inc1.devtunnels.ms/api/standards/${standardId}/subjects`
      );

      console.log("Subjects API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(
          `Failed to fetch subjects: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const subjectsData = await response.json();
      console.log("Subjects data from API:", subjectsData);
      console.log("Number of subjects loaded:", subjectsData.length);

      // Add a test paid subject for demonstration
      const subjectsWithTest = [
        ...subjectsData,
        { id: 999, name: "Premium Mathematics", price: 299 }
      ];
      
      setSubjects((prev) => ({
        ...prev,
        [standardId]: subjectsWithTest,
      }));
    } catch (err) {
      console.error("Error fetching subjects:", err);
      setError(`Failed to load subjects from admin panel: ${err}`);
      setSubjects((prev) => ({
        ...prev,
        [standardId]: [],
      }));
    }
  };

  // Fetch questions for selected subject
  const fetchQuestions = async (subjectId: number, chapterName?: string) => {
    setLoadingQuestions(true);
    setError("");
    try {
      let url = `${ADMIN_BASE_URL}/api/subjects/${subjectId}/questions`;
      if (chapterName) {
        // Find chapter object by name
        const chapterObj = chapters.find(c => c.name === chapterName);
        if (chapterObj && chapterObj.id) {
          url = `${ADMIN_BASE_URL}/api/chapters/${chapterObj.id}/questions`;
        }
      }
      const response = await fetch(url);
      console.log("Questions API response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(
          `Failed to fetch questions: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON received for questions endpoint. First 200 chars:', text.slice(0, 200));
        throw new SyntaxError('Questions API returned non-JSON (HTML). The endpoint may be incorrect or the server returned an error page.');
      }
      const questionsData = await response.json();
      console.log("Questions data from API:", questionsData);
      console.log("Number of questions loaded:", questionsData.length);
      const normalized = Array.isArray(questionsData) ? questionsData.map(normalizeQuestion) : [];
      if (chapterName) {
        setChapterQuestions(normalized);
      } else {
        setQuestions((prev) => ({
          ...prev,
          [subjectId]: normalized,
        }));
      }
      return normalized as Question[];
    } catch (err) {
      console.error("Error fetching questions:", err);
      const msg = err instanceof SyntaxError ? 'Server returned HTML instead of JSON. Please ensure the API URL is correct and the server is running.' : String(err);
      setError(`Failed to load questions from admin panel: ${msg}`);
      setQuestions((prev) => ({
        ...prev,
        [subjectId]: [],
      }));
      return [] as Question[];
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Fetch chapters for selected subject
  const fetchChapters = async (subjectId: number) => {
    setLoadingChapters(true);
    setError("");
    try {
      const response = await fetch(
        `${ADMIN_BASE_URL}/api/subjects/${subjectId}/chapters`
      );
      if (!response.ok) throw new Error("Failed to fetch chapters");
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON received for chapters endpoint. First 200 chars:', text.slice(0, 200));
        throw new SyntaxError('Chapters API returned non-JSON (HTML).');
      }
      const data = await response.json();
      setChapters(data);
    } catch (err: any) {
      const msg = err instanceof SyntaxError ? 'Server returned HTML instead of JSON. Please check the chapters API.' : err.message;
      setError("Failed to load chapters from admin panel: " + msg);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Load subjects when a standard is selected
  useEffect(() => {
    if (selectedStandard?.id && currentStep === "subjects") {
      loadSubjectsForStandard(selectedStandard.id);
    }
  }, [selectedStandard, currentStep]);

  // Call fetchChapters when a subject is selected
  useEffect(() => {
    if (selectedSubject?.id) {
      fetchChapters(selectedSubject.id);
    }
  }, [selectedSubject]);

  const sendOtp = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    // Throttle OTP requests using localStorage timestamp
    try {
      const key = `spg_last_otp_ts_${email.trim().toLowerCase()}`;
      const lastTsRaw = localStorage.getItem(key);
      const now = Date.now();
      if (lastTsRaw) {
        const lastTs = Number(lastTsRaw);
        const remaining = OTP_COOLDOWN_MS - (now - lastTs);
        if (Number.isFinite(lastTs) && remaining > 0) {
          const seconds = Math.ceil(remaining / 1000);
          setError(`Please wait ${seconds}s before requesting another OTP.`);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    // If email already verified on this browser, bypass OTP
    try {
      const savedEmail = localStorage.getItem("spg_logged_in_email");
      if (savedEmail && savedEmail.toLowerCase() === email.trim().toLowerCase()) {
        setIsOtpSent(false);
        setLoading(false);
        setError("");
        setCurrentStep("main-menu");
        toast({ title: "Welcome back", description: "Logged in without OTP." });
        return;
      }
    } catch {
      // ignore storage errors and continue with OTP flow
    }

    setLoading(true);
    setError("");

    try {
  const response = await fetch(`${OTP_BASE_URL}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsOtpSent(true);
        setLoading(false);
        // Save OTP timestamp to enforce cooldown
        try {
          const key = `spg_last_otp_ts_${email.trim().toLowerCase()}`;
          localStorage.setItem(key, String(Date.now()));
        } catch {}
        toast({
          title: "OTP Sent",
          description: "Please check your email for the verification code.",
        });
        return;
      } else {
        setError("Could not connect to OTP service. Please check if the server is running and accessible.");
        setLoading(false);
      }
    } catch (err) {
      setError("Could not connect to OTP service. Please check if the server is running and accessible.");
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 4) {
      setError("Please enter a valid OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
  const response = await fetch(`${OTP_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      if (response.ok) {
        const result = await response.json();
        // Persist session for future auto-login
        try {
          localStorage.setItem("spg_logged_in_email", email);
        } catch {}
        // If board/standard already saved, jump to subjects
        try {
          const boardRaw = localStorage.getItem("spg_selected_board");
          const standardRaw = localStorage.getItem("spg_selected_standard");
          if (boardRaw && standardRaw) {
            const board = JSON.parse(boardRaw);
            const standard = JSON.parse(standardRaw);
            setSelectedBoard(board);
            setSelectedStandard(standard);
            setCurrentStep("subjects");
          } else {
            setCurrentStep("main-menu");
          }
        } catch {
          setCurrentStep("main-menu");
        }
        setLoading(false);
        toast({
          title: "Login Successful",
          description: "Welcome to the Student Portal!",
        });
        return;
      } else {
        setError("Could not verify OTP. Please check if the server is running and accessible.");
        setLoading(false);
      }
    } catch (err) {
      setError("Could not verify OTP. Please check if the server is running and accessible.");
      setLoading(false);
    }
  };

  const selectBoard = async (board: Board) => {
    setSelectedBoard(board);
    setShowBoardsPopup(false);
    // persist selected board
    try {
      localStorage.setItem("spg_selected_board", JSON.stringify(board));
    } catch {}

    // Fetch standards for this board if not already loaded
    if (!standards[board.id]) {
      await fetchStandards(board.id);
    }

    setShowStandardsPopup(true);
  };

  const selectStandard = async (standard: Standard) => {
    setSelectedStandard(standard);
    setShowStandardsPopup(false);
    // persist selected standard
    try {
      localStorage.setItem("spg_selected_standard", JSON.stringify(standard));
    } catch {}

    // Load subjects for this standard
    await loadSubjectsForStandard(standard.id);

    setCurrentStep("subjects");
  };

  const selectSubject = async (subject: Subject) => {
    handleSubjectSelection(subject);
  };

  // Helper: generate random paper for current subject
  const createRandomPaper = async () => {
    try {
      if (!selectedSubject?.id) return;
      if (!questions[selectedSubject.id]) {
        await fetchQuestions(selectedSubject.id);
      }
      const pool = questions[selectedSubject.id] || [];
      if (pool.length === 0) {
        setError("No questions available to generate a random paper.");
        return;
      }
      // Build by targetTotalMarks: prefer larger marks, but split into sections A/B later
      const picked = pickQuestionsForTarget(pool, targetTotalMarks);
      // Shuffle inside MCQ and non-MCQ pools for randomness
      const withCt = picked.map(q => ({ ...q, _ct: canonicalType(q.type) }));
      const mcqs = withCt.filter(q => q._ct === 'MCQ').sort(() => Math.random() - 0.5);
      const others = withCt.filter(q => q._ct !== 'MCQ').sort((a, b) => (a.marks || 0) - (b.marks || 0));
      const arranged = [...mcqs, ...others];
      setSelectedQuestions(arranged);
      setSelectedChapter('All Chapters');
      setSelectedQuestionType('Mixed');
      setCurrentStep("paper-review");
    } catch (e) {
      console.error(e);
      setError("Failed to generate random paper.");
    }
  };

  const pickQuestionsForTarget = (pool: Question[], target: number): Question[] => {
    const normalized = pool.filter(q => Number.isFinite(q.marks) && (q.marks as any) > 0);
    if (normalized.length === 0) return [];
    const shuffled = [...normalized].sort(() => Math.random() - 0.5);
    // Greedy: prefer higher marks first, then fill with smaller ones
    const byMarksDesc = [...shuffled].sort((a, b) => (b.marks || 0) - (a.marks || 0));
    const picked: Question[] = [];
    let sum = 0;
    for (const q of byMarksDesc) {
      if (sum + (q.marks || 0) <= target) {
        picked.push(q);
        sum += q.marks || 0;
        if (sum === target) return picked;
      }
    }
    // If exact not reached, try to adjust by swapping small ones
    if (sum < target) {
      const remaining = byMarksDesc.filter(q => !picked.includes(q));
      for (const q of remaining) {
        if (sum + (q.marks || 0) <= target) {
          picked.push(q);
          sum += q.marks || 0;
          if (sum === target) break;
        }
      }
    }
    // Fallback: if nothing picked, pick the smallest single question
    if (picked.length === 0) {
      const smallest = byMarksDesc[byMarksDesc.length - 1];
      if (smallest) picked.push(smallest);
    }
    return picked;
  };

  if (currentStep === "login") {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card animate-fade-in">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              Student Paper Generator
            </CardTitle>
            <CardDescription>
              Login to access your academic resources
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!isOtpSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="h-12"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={sendOtp}
                  disabled={loading}
                  variant="academic"
                  className="w-full h-12"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send OTP
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-academic-background rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-academic-blue" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We've sent a verification code to
                    <br />
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="h-12 text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={verifyOtp}
                  disabled={loading}
                  variant="academic"
                  className="w-full h-12"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                <Button
                  onClick={() => setIsOtpSent(false)}
                  variant="ghost"
                  className="w-full"
                >
                  Change Email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "boards") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
        <div className="w-full max-w-xl mx-auto">
          <div className="bg-white rounded-t-2xl shadow-2xl p-6 max-h-[80vh] animate-slide-up relative flex flex-col">
            <button
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 z-10"
              onClick={() => setCurrentStep('login')}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Select Your Board</h1>
              <p className="text-sm text-gray-500">Choose your education board to continue</p>
            </div>
            {loadingBoards ? (
              <div className="text-center py-8">
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-500" />
                <p className="text-gray-400 mt-2">Loading boards...</p>
              </div>
            ) : (
              <>
                {/* Search Boards */}
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search boards..."
                    value={boardQuery}
                    onChange={(e) => setBoardQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {/* Scrollable boards container */}
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                    {boards
                      .filter((b) => b.name.toLowerCase().includes(boardQuery.trim().toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((board) => (
                      <Card
                        key={board.id}
                        onClick={() => selectBoard(board)}
                        className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors flex-shrink-0">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold leading-tight">{board.language ? `${board.name} (${board.language})` : board.name}</h3>
                              {board.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{board.description}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Standards Popup */}
        {showStandardsPopup && selectedBoard && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
            <div className="w-full max-w-xl mx-auto">
              <div className="bg-white rounded-t-2xl shadow-2xl p-6 max-h-[80vh] animate-slide-up relative flex flex-col">
                <button
                  className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 z-10"
                  onClick={() => setShowStandardsPopup(false)}
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Select Standard - {selectedBoard.name}</h1>
                </div>
                {standards[selectedBoard.id] ? (
                  <>
                    {/* Search Standards */}
                    <div className="mb-4 relative">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Search standards..."
                        value={standardQuery}
                        onChange={(e) => setStandardQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {/* Scrollable standards container */}
                    <div className="flex-1 overflow-y-auto pr-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                        {standards[selectedBoard.id]
                          .filter((s) => s.name.toLowerCase().includes(standardQuery.trim().toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((standard) => (
                          <Card
                            key={standard.id}
                            onClick={() => selectStandard(standard)}
                            className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors flex-shrink-0">
                                  <BookOpen className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-semibold leading-tight">{standard.name}</h3>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-green-500" />
                    <p className="text-muted-foreground mt-2">Loading standards...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentStep === "subjects") {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto px-4 py-6">
         

          {/* Dropdown Selectors */}
          <div className="mb-6">
            <div className="flex gap-3">
              <div 
                onClick={() => setCurrentStep("boards")}
                className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Board</div>
                    <div className="text-sm font-semibold text-gray-800 truncate">{selectedBoard?.name || "Select Board"}</div>
                  </div>
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm ml-2">
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  </div>
                </div>
              </div>
              
              <div 
                onClick={() => setCurrentStep("boards")}
                className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Standard</div>
                    <div className="text-sm font-semibold text-gray-800 truncate">{selectedStandard?.name || "Select Standard"}</div>
                  </div>
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm ml-2">
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search subjects..."
                value={subjectQuery}
                onChange={(e) => setSubjectQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
              />
            </div>
          </div>


          {/* Subjects Grid */}
          <div className="min-h-[50vh]">
            {!selectedBoard || !selectedStandard ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Select Board & Standard</h3>
                <p className="text-gray-500 text-sm">Please select your board and standard to view subjects</p>
              </div>
            ) : loadingBoards ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm">Loading subjects...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-4 gap-6 pb-4">
                  {subjects[selectedStandard.id] ? (
                    subjects[selectedStandard.id]
                      .filter((subject) => {
                        const name = typeof subject === "object" ? subject.name : String(subject);
                        return name.toLowerCase().includes(subjectQuery.trim().toLowerCase());
                      })
                      .sort((a, b) => {
                        const an = typeof a === "object" ? a.name : String(a);
                        const bn = typeof b === "object" ? b.name : String(b);
                        return an.localeCompare(bn);
                      })
                      .map((subject, index) => {
                        const subjectObj = typeof subject === "object" ? subject : { name: subject, price: 0 };
                        const isFree = !subjectObj.price || subjectObj.price === 0;
                        
                        return (
                          <div
                            key={index}
                            onClick={() => selectSubject(subjectObj)}
                            className="cursor-pointer flex flex-col items-center gap-3 p-2 hover:opacity-80 transition-opacity duration-200"
                          >
                            <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200">
                              <BookOpen className="w-8 h-8 text-gray-600" />
                            </div>
                            <div className="text-center">
                              <h3 className="text-xs font-medium text-gray-800 leading-tight">
                                {subjectObj.name}
                              </h3>
                              {isFree ? (
                                <span className="text-xs text-green-600 font-medium mt-1 block">
                                  Free
                                </span>
                              ) : (
                                <span className="text-xs text-orange-600 font-medium mt-1 block">
                                  ₹{subjectObj.price}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="col-span-4 text-center py-8">
                      <p className="text-gray-500">No subjects available for this standard</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Payment Modal */}
        {showPaymentModal && selectedSubject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold">Payment Required</CardTitle>
              <CardDescription>
                Access to {selectedSubject.name} requires payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  ₹{selectedSubject.price}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  One-time payment for unlimited access to {selectedSubject.name} content
                </p>
                
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">What you'll get:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Unlimited question paper generation</li>
                    <li>• All difficulty levels and question types</li>
                    <li>• PDF download and printing</li>
                    <li>• Lifetime access to {selectedSubject.name} content</li>
                  </ul>
                </div>
              </div>
                
                <div className="space-y-2">
                  <Button 
                    onClick={handlePayButtonClick}
                    disabled={paymentLoading || !razorpayLoaded}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {paymentLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay
                      </>
                    )}
                  </Button>
                  
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
                
                {!razorpayLoaded && (
                  <Alert>
                    <AlertDescription>
                      Payment system is loading. Please wait...
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (currentStep === "main-menu") {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Study Path Genie</h1>
            <p className="text-gray-600">Choose what you'd like to do</p>
          </div>

          {/* Menu Options */}
          <div className="space-y-4">
            {/* Generate Papers */}
            <div
              onClick={() => setCurrentStep("boards")}
              className="cursor-pointer bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl">Generate Papers</h3>
                  <p className="text-blue-100 text-sm">Create question papers for your subjects</p>
                </div>
              </div>
            </div>

            {/* Created Papers */}
            <div
              onClick={() => setCurrentStep("created-papers")}
              className="cursor-pointer bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl">Created Papers</h3>
                  <p className="text-green-100 text-sm">View and manage your generated papers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "created-papers") {
    return <CreatedPapers onBack={() => setCurrentStep("main-menu")} />;
  }

  if (currentStep === "paper-options") {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Choose Paper Generation Method
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("subjects")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Subject
              </Button>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <Card
                  onClick={() => {
                    setPaperMode("random");
                    setCurrentStep("chapter-selection");
                  }}
                  className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold">Random Paper</h3>
                        <p className="text-sm text-muted-foreground">Generate a random question paper</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  onClick={() => {
                    setPaperMode("difficulty");
                    setCurrentStep("chapter-selection");
                  }}
                  className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold">By Difficulty</h3>
                        <p className="text-sm text-muted-foreground">Generate paper by difficulty level</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  onClick={() => {
                    setPaperMode("chapter");
                    setCurrentStep("multi-chapter-selection");
                  }}
                  className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold">By Chapter</h3>
                        <p className="text-sm text-muted-foreground">Generate paper by chapter</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>

                <Card
                  onClick={() => {
                    setPaperMode("custom");
                    setCurrentStep("custom-builder");
                  }}
                  className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <Mail className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold">Custom Paper</h3>
                        <p className="text-sm text-muted-foreground">Create custom question paper</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {loadingQuestions && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-academic-purple" />
                  <p className="text-muted-foreground mt-2">Loading questions...</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // New: Multi Chapter Selection and Auto Generation
  if (currentStep === "multi-chapter-selection") {
    const toggleChapter = (chapterId: number) => {
      setSelectedChapters(prev => prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]);
    };

    const generateFromSelectedChapters = async () => {
      if (!selectedSubject?.id || selectedChapters.length === 0) return;
      setMultiChapterLoading(true);
      setError("");
      try {
        const aggregated: Question[] = [];
        for (const chapterId of selectedChapters) {
          const response = await fetch(`${ADMIN_BASE_URL}/api/chapters/${chapterId}/questions`);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch questions for chapter ${chapterId}: ${response.status} ${response.statusText} - ${errorText}`);
          }
          const data: any[] = await response.json();
          const normalized = data.map((q) => normalizeQuestion(q));
          aggregated.push(...(normalized as Question[]));
        }

        setSelectedQuestions(aggregated);
        const selectedNames = chapters.filter(c => selectedChapters.includes(c.id)).map(c => c.name);
        setSelectedChapter(selectedNames);
        setCurrentStep("paper-review");
      } catch (err: any) {
        setError(`Failed to generate from chapters: ${err.message || err}`);
      } finally {
        setMultiChapterLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Select Chapters
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("paper-options")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Paper Mode
              </Button>
            </CardHeader>

            <CardContent>
              {chapters.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {chapters.map((chapter) => (
                      <Card key={chapter.id} className="p-4">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id={`chapter-${chapter.id}`}
                            checked={selectedChapters.includes(chapter.id)}
                            onCheckedChange={() => toggleChapter(chapter.id)}
                          />
                          <Label htmlFor={`chapter-${chapter.id}`} className="cursor-pointer">
                            {chapter.name}
                          </Label>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {selectedChapters.length} chapter{selectedChapters.length === 1 ? '' : 's'} selected
                    </div>
                    <Button
                      onClick={generateFromSelectedChapters}
                      disabled={selectedChapters.length === 0 || multiChapterLoading}
                      className="bg-academic-blue hover:bg-academic-blue/90"
                    >
                      {multiChapterLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                        </>
                      ) : (
                        <>Generate Paper</>
                      )}
                    </Button>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No chapters available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "chapter-selection") {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                {paperMode === 'chapter' ? 'Select Chapters' : 'Select Chapter'}
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("paper-options")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Paper Mode
              </Button>
            </CardHeader>

            <CardContent>
              {/* Search Chapters */}
              <div className="mb-4 max-w-md mx-auto relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search chapters..."
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Removed marks input here for Random Paper, keep it on review page only */}

              {chapters.length > 0 ? (
                <div className="space-y-3">
                  {chapters
                    .filter((chapter) => chapter.name.toLowerCase().includes(chapterQuery.trim().toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((chapter, index) => (
                    <Card
                      key={chapter.id || index}
                      className="border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {paperMode === 'chapter' ? (
                            <Checkbox
                              id={`chapter-${chapter.id}`}
                              checked={selectedChapterNames.includes(chapter.name)}
                              onCheckedChange={(checked) => {
                                setSelectedChapterNames(prev => {
                                  const set = new Set(prev);
                                  if (checked) set.add(chapter.name); else set.delete(chapter.name);
                                  return Array.from(set);
                                });
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                              <BookOpen className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold whitespace-normal break-words leading-snug">
                              {chapter.name}
                            </h3>
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs">Chapter</Badge>
                            </div>
                          </div>
                          {paperMode !== 'chapter' && (
                            <Button
                              onClick={() => {
                                const handleChapterSelect = async () => {
                                  setSelectedChapter(chapter.name);
                                  if (paperMode === 'random') {
                                    const data = await fetchQuestions(selectedSubject.id!, chapter.name);
                                    const pool = data || [];
                                    if (pool.length === 0) { setError("No questions available in this chapter."); return; }
                                    const picked = pickQuestionsForTarget(pool, targetTotalMarks);
                                    const withCt = picked.map(q => ({ ...q, _ct: canonicalType(q.type) }));
                                    const mcqs = withCt.filter(q => q._ct === 'MCQ').sort(() => Math.random() - 0.5);
                                    const others = withCt.filter(q => q._ct !== 'MCQ').sort((a, b) => (a.marks || 0) - (b.marks || 0));
                                    const arranged = [...mcqs, ...others];
                                    setSelectedQuestions(arranged);
                                    setSelectedQuestionType('Mixed');
                                    setCurrentStep("paper-review");
                                  } else {
                                    await fetchQuestions(selectedSubject.id!, chapter.name);
                                    setCurrentStep("question-type-selection");
                                  }
                                };
                                handleChapterSelect();
                              }}
                              variant="secondary"
                            >
                              Select
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No chapters available</p>
                </div>
              )}

              {paperMode === 'chapter' && (
                <div className="mt-6">
                  <div className="flex justify-end">
                    <Button
                      disabled={selectedChapterNames.length === 0}
                      onClick={async () => {
                        try {
                          if (!selectedSubject?.id) return;
                          // Fetch all questions from selected chapters
                          const all: Question[] = [];
                          for (const chName of selectedChapterNames) {
                            const data = await fetchQuestions(selectedSubject.id!, chName);
                            all.push(...data);
                          }
                          const allowed = new Set(selectedChapterNames);
                          const pool = all.filter(q => allowed.has(q.chapter));
                          if (pool.length === 0) {
                            setError('No questions found in selected chapters.');
                            return;
                          }
                          setSelectedQuestions(pool);
                          setSelectedChapter(selectedChapterNames.join(', '));
                          setSelectedQuestionType('Mixed');
                          // Immediately generate PDF
                          await new Promise(resolve => setTimeout(resolve, 0));
                          await generatePDF();
                        } catch (e) {
                          console.error(e);
                          setError('Failed to generate PDF from selected chapters.');
                        }
                      }}
                      className="bg-academic-blue hover:bg-academic-blue/90"
                    >
                      Generate PDF
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "question-type-selection") {
  const questionTypes = [...new Set(chapterQuestions.map(q => q.type))];

    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Select Question Type
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name} - {selectedChapter}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("chapter-selection")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Chapter
              </Button>
            </CardHeader>

            <CardContent>
              {questionTypes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {questionTypes.map((type, index) => (
                    <Card
                      key={index}
                      onClick={() => {
                        setSelectedQuestionType(type);
                        setCurrentStep("question-selection");
                      }}
                      className="cursor-pointer hover:shadow-elegant transform hover:scale-105 transition-all duration-300 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0"
                    >
                      <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <BookOpen className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold">{type}</h3>
                        <p className="text-indigo-100 mt-2">
                          {chapterQuestions.filter(q => q.type === type).length} questions
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No question types available</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "question-selection") {
    const filteredQuestions = chapterQuestions.filter(q => q.type === selectedQuestionType);

    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Select Questions
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name} - {selectedChapter} - {selectedQuestionType}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("question-type-selection")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Question Type
              </Button>
            </CardHeader>

            <CardContent>
              {filteredQuestions.length > 0 ? (
                <div className="space-y-4">
                  {filteredQuestions.map((question) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex items-start space-x-4">
                        <Checkbox
                          id={`question-${question.id}`}
                          checked={selectedQuestions.some(q => q.id === question.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedQuestions(prev => [...prev, question]);
                            } else {
                              setSelectedQuestions(prev => prev.filter(q => q.id !== question.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`question-${question.id}`}
                            className="text-base font-medium cursor-pointer"
                          >
                            {question.question || question.text || question.content || '[No question text]'}
                          </Label>
                          <div className="text-sm text-muted-foreground mt-1">
                            {question.marks} marks • {question.difficulty} • {question.type}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}

                  <div className="flex justify-between items-center pt-6">
                    <div className="text-sm text-muted-foreground">
                      {selectedQuestions.length} questions selected
                    </div>
                    <Button
                      onClick={generatePDF}
                      disabled={selectedQuestions.length === 0}
                      className="bg-academic-blue hover:bg-academic-blue/90"
                    >
                      Review Paper ({selectedQuestions.length} questions)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No questions available for this type</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "paper-review") {
    return (
      <div className="min-h-screen bg-gradient-background p-2 sm:p-4 overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center px-2 sm:px-6">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Review Your Question Paper
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep(paperMode === 'random' ? 'paper-options' : 'question-selection')}
                variant="ghost"
                className="mt-2 text-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {paperMode === 'random' ? 'Change Mode' : 'Edit Questions'}
              </Button>
            </CardHeader>

            <CardContent className="flex flex-col h-[70vh] px-2 sm:px-6">
              {/* Editable header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 flex-shrink-0">
                <div>
                  <Label htmlFor="examTitle">Exam Title</Label>
                  <Input id="examTitle" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g., Mid-Term Examination" />
                </div>
                <div>
                  <Label htmlFor="schoolName">School/Institute</Label>
                  <Input id="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g., Springfield High" />
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input id="duration" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} placeholder="e.g., 2 Hours" />
                </div>
                <div>
                  <Label htmlFor="targetMarks">Target Total Marks</Label>
                  <Input
                    id="targetMarks"
                    type="number"
                    min={1}
                    value={targetTotalMarks}
                    onChange={(e) => setTargetTotalMarks(Math.max(1, parseInt(e.target.value || '0', 10)))}
                    placeholder="e.g., 50"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Input id="instructions" value={examInstructions} onChange={(e) => setExamInstructions(e.target.value)} placeholder="e.g., Answer all questions." />
                </div>
              </div>

              {selectedQuestions.length > 0 ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="bg-gray-50 p-4 rounded-lg mb-4 flex-shrink-0">
                    <h3 className="font-semibold mb-2">Paper Summary</h3>
                    <p className="text-sm text-muted-foreground">
                      Total Questions: {selectedQuestions.length} |
                      Total Marks: {selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)} |
                      Target: {targetTotalMarks} |
                      {selectedChapter ? <>Chapter: {selectedChapter} | </> : null}
                      {selectedQuestionType ? <>Type: {selectedQuestionType}</> : null}
                    </p>
                  </div>

                  {/* Scrollable questions container */}
                  <div className="flex-1 overflow-y-auto pr-2">
                    <div className="space-y-6 pb-4">
                      {(() => {
                        // If user built custom sections/subsections, render them
                        if (customSections.length > 0) {
                          let qNum = 1;
                          const nonEmptySections = customSections.filter(sec => sec.subsections.some(sub => sub.questions.length > 0));
                          return nonEmptySections.map((sec, sidx) => (
                            <div key={sec.id} className="space-y-3">
                              <h3 className="font-semibold text-base">{`Section ${String.fromCharCode(65 + sidx)}: ${sec.title || '-'}`}</h3>
                              {sec.subsections.filter(sub => sub.questions.length > 0).map(sub => (
                                <div key={sub.id} className="space-y-2">
                                  <div className="font-medium text-sm">{sub.title || '-'}</div>
                                  {sub.questions.map((q) => {
                                    const index = qNum++;
                                    return (
                                      <Card key={q.id} className="p-3 sm:p-4">
                                        <div className="flex flex-col gap-3">
                                          <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm sm:text-base">Q{index}</h4>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setCustomSections(prev => prev.map(s => s.id === sec.id ? { ...s, subsections: s.subsections.map(su => su.id === sub.id ? { ...su, questions: su.questions.filter(qq => qq.id !== q.id) } : su) } : s));
                                              }}
                                              className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                                            <div className="sm:col-span-5">
                                              <Label className="text-xs sm:text-sm">Question Text</Label>
                                              <textarea
                                                value={q.text}
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  setCustomSections(prev => prev.map(s => s.id === sec.id ? {
                                                    ...s,
                                                    subsections: s.subsections.map(su => su.id === sub.id ? {
                                                      ...su,
                                                      questions: su.questions.map(qq => qq.id === q.id ? { ...qq, text: value } : qq)
                                                    } : su)
                                                  } : s));
                                                }}
                                                className="w-full min-h-[60px] sm:min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm resize-none"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs sm:text-sm">Marks</Label>
                                              <Input
                                                type="number"
                                                value={String(q.marks)}
                                                readOnly
                                                className="text-xs sm:text-sm opacity-70 cursor-not-allowed"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </Card>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          ));
                        }

                        // Default grouping view (MCQ/Others) when not using custom builder
                        const withCt = selectedQuestions.map(q => ({ ...q, _ct: canonicalType(q.type) }));
                        const mcqItems = withCt.filter(q => q._ct === 'MCQ');
                        const otherItems = withCt.filter(q => q._ct !== 'MCQ').sort((a, b) => (a.marks || 0) - (b.marks || 0));
                        const nonEmpty: { title: string; items: typeof withCt }[] = [];
                        if (mcqItems.length > 0) nonEmpty.push({ title: 'Section A: MCQ', items: mcqItems });
                        if (otherItems.length > 0) nonEmpty.push({ title: nonEmpty.length === 0 ? 'Section A: Others' : 'Section B: Others', items: otherItems });
                        let qNum = 1;
                        return nonEmpty.map((sec, idx) => (
                          <div key={idx} className="space-y-3">
                            <h3 className="font-semibold text-base">{sec.title}</h3>
                            {sec.items.map((question) => {
                              const index = qNum++;
                              return (
                                <Card key={question.id} className="p-3 sm:p-4">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-sm sm:text-base">Q{index}</h4>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedQuestions(prev => prev.filter(q => q.id !== question.id));
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                                      <div className="sm:col-span-5">
                                        <Label className="text-xs sm:text-sm">Question Text</Label>
                                        <textarea
                                          value={question.question || (question as any).text || (question as any).content || ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setSelectedQuestions(prev => prev.map(q => q.id === question.id ? { ...q, question: value } : q));
                                          }}
                                          className="w-full min-h-[60px] sm:min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm resize-none"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs sm:text-sm">Marks</Label>
                                        <Input
                                          type="number"
                                          value={Number.isFinite(question.marks) ? String(question.marks) : ''}
                                          readOnly
                                          className="text-xs sm:text-sm opacity-70 cursor-not-allowed"
                                        />
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Difficulty: {question.difficulty || '-'} • Type: {question.type || '-'}
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="flex justify-center pt-6 gap-3 flex-shrink-0">
                    <Button onClick={generatePDF} className="bg-green-600 hover:bg-green-700">Download PDF</Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No questions selected</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "paper-display") {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Question Paper
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("paper-options")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Generation Method
              </Button>
            </CardHeader>

            <CardContent>
              {selectedQuestions.length > 0 ? (
                <div className="space-y-6">
                  {selectedQuestions.map((question, index) => (
                    <div key={question.id} className="border-b pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold">
                          Q{index + 1}. {getQuestionText(question) || '[No question text]'}
                          Q{index + 1}. {getQuestionText(question) || '[No question text]'}
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          {question.marks} marks • {question.difficulty} • {question.chapter}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Type: {question.type}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No questions selected</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === "custom-builder") {
    const addSection = () => {
      setCustomSections(prev => [...prev, { id: `sec-${Date.now()}`, title: `Section ${String.fromCharCode(65 + prev.length)}`, subsections: [] }]);
    };
    const addSubsection = (secId: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, subsections: [...s.subsections, { id: `sub-${Date.now()}`, title: 'Subsection', questions: [] }] } : s));
    };
    const addQuestion = (secId: string, subId: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, questions: [...sub.questions, { id: `q-${Date.now()}`, text: '', marks: 1 }] } : sub) } : s));
    };
    const updateTitles = (secId: string, value: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, title: value } : s));
    };
    const updateSubTitle = (secId: string, subId: string, value: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, title: value } : sub) } : s));
    };
    const updateQuestion = (secId: string, subId: string, qId: string, key: 'text' | 'marks', value: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, questions: sub.questions.map(q => q.id === qId ? { ...q, [key]: key === 'marks' ? Math.max(0, parseInt(value || '0', 10)) : value } : q) } : sub) } : s));
    };
    const removeQuestion = (secId: string, subId: string, qId: string) => {
      setCustomSections(prev => prev.map(s => s.id === secId ? { ...s, subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, questions: sub.questions.filter(q => q.id !== qId) } : sub) } : s));
    };
    const buildAndGoToReview = () => {
      const qs: Question[] = [] as any;
      customSections.forEach((s) => {
        s.subsections.forEach((sub) => {
          sub.questions.forEach((q) => {
            qs.push({ id: Math.random()*1e12, question: q.text || '[No question text]', type: sub.title || '-', difficulty: '-', chapter: s.title, marks: q.marks });
          });
        });
      });
      setSelectedQuestions(qs);
      setSelectedChapter('Custom');
      setSelectedQuestionType('Mixed');
      setCurrentStep('paper-review');
    };

    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">Custom Paper Builder</CardTitle>
              <CardDescription>{selectedBoard?.name} - {selectedStandard?.name} - {selectedSubject?.name}</CardDescription>
              <Button onClick={() => setCurrentStep('paper-options')} variant="ghost" className="mt-2">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sections area */}
              <div className="space-y-4">
                {customSections.map((sec) => (
                  <div key={sec.id} className="border rounded-md p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <Input value={sec.title} onChange={(e) => updateTitles(sec.id, e.target.value)} placeholder="Section title (e.g., Section A)" />
                      </div>
                      <Button onClick={() => addSubsection(sec.id)} variant="secondary" size="icon" title="Add Subsection">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {sec.subsections.map((sub) => (
                        <div key={sub.id} className="rounded-md border p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div className="md:col-span-2">
                              <Input value={sub.title} onChange={(e) => updateSubTitle(sec.id, sub.id, e.target.value)} placeholder="Subsection title (e.g., MCQ / Short / Long)" />
                            </div>
                            <div className="flex gap-2 md:justify-end">
                              <Button onClick={() => addQuestion(sec.id, sub.id)} size="sm">Add Question</Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  setPickerSubId(sub.id);
                                  setPickerSelected(new Set());
                                  setPickerChapter('');
                                  setPickerQuestions([]);
                                }}
                              >
                                Add from Bank
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {sub.questions.map((q) => (
                              <div key={q.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
                                <div className="md:col-span-5">
                                  <Label className="text-xs">Question</Label>
                                  <textarea
                                    value={q.text}
                                    onChange={(e) => setCustomSections(prev => prev.map(s => s.id === sec.id ? { ...s, subsections: s.subsections.map(su => su.id === sub.id ? { ...su, questions: su.questions.map(qq => qq.id === q.id ? { ...qq, text: e.target.value } : qq) } : su) } : s))}
                                    className="w-full min-h-[56px] rounded-md border border-input bg-background px-3 py-2 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Marks</Label>
                                  <Input type="number" value={String(q.marks)} onChange={(e) => setCustomSections(prev => prev.map(s => s.id === sec.id ? { ...s, subsections: s.subsections.map(su => su.id === sub.id ? { ...su, questions: su.questions.map(qq => qq.id === q.id ? { ...qq, marks: Math.max(0, parseInt(e.target.value || '0', 10)) } : qq) } : su) } : s))} />
                                  <Button variant="ghost" size="sm" className="text-red-500 mt-1" onClick={() => removeQuestion(sec.id, sub.id, q.id)}>Remove</Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Inline bank picker */}
                          {pickerSubId === sub.id && (
                            <div className="mt-4 border rounded-md p-3 bg-gray-50">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                <div className="md:col-span-2">
                                  <Label className="text-xs">Choose Chapter</Label>
                                  <select
                                    className="w-full border rounded-md h-9 px-2"
                                    value={pickerChapter}
                                    onChange={async (e) => {
                                      const name = e.target.value;
                                      setPickerChapter(name);
                                      if (!selectedSubject?.id || !name) { setPickerQuestions([]); return; }
                                      setPickerLoading(true);
                                      const data = await fetchQuestions(selectedSubject.id, name);
                                      setPickerQuestions(data);
                                      setPickerLoading(false);
                                    }}
                                  >
                                    <option value="">-- Select chapter --</option>
                                    {chapters.map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex md:justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      // Add selected to subsection
                                      const chosen = pickerQuestions.filter(q => pickerSelected.has(q.id));
                                      if (chosen.length === 0) { setPickerSubId(null); return; }
                                      setCustomSections(prev => prev.map(s => s.id === sec.id ? {
                                        ...s,
                                        subsections: s.subsections.map(su => su.id === sub.id ? {
                                          ...su,
                                          questions: [
                                            ...su.questions,
                                            ...chosen.map(q => ({ id: `q-${q.id}-${Date.now()}`, text: q.question || (q as any).text || (q as any).content || '[No question text]', marks: q.marks || 1 }))
                                          ]
                                        } : su)
                                      } : s));
                                      setPickerSubId(null);
                                    }}
                                  >
                                    Add Selected
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3">
                                {pickerLoading ? (
                                  <div className="text-sm text-muted-foreground">Loading questions...</div>
                                ) : pickerQuestions.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">Select a chapter to view questions.</div>
                                ) : (
                                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {pickerQuestions.map(q => (
                                      <label key={q.id} className="flex items-start gap-2 p-2 border rounded-md bg-white">
                                        <input
                                          type="checkbox"
                                          checked={pickerSelected.has(q.id)}
                                          onChange={(e) => {
                                            setPickerSelected(prev => {
                                              const next = new Set(prev);
                                              if (e.target.checked) next.add(q.id); else next.delete(q.id);
                                              return next;
                                            });
                                          }}
                                        />
                                        <div className="text-sm">
                                          <div className="font-medium">{q.question || (q as any).text || (q as any).content || '[No question text]'}</div>
                                          <div className="text-xs text-muted-foreground">Marks: {q.marks ?? '-'} • {q.type ?? '-'}</div>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <Button onClick={addSection} variant="default" className="rounded-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Section
                </Button>
              </div>

              {customSections.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={buildAndGoToReview} className="bg-academic-blue hover:bg-academic-blue/90">Continue to Review</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs z-[200]">
          <div>Payment Modal: {showPaymentModal ? 'SHOWING' : 'HIDDEN'}</div>
          <div>Selected Subject: {selectedSubject?.name || 'None'}</div>
          <div>Subject Price: {selectedSubject?.price || 'None'}</div>
          <div>Razorpay Loaded: {razorpayLoaded ? 'YES' : 'NO'}</div>
        </div>
      )}
    </>
  );
};

export default StudentPortal;