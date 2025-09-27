import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, BookOpen, GraduationCap, Users, X, ChevronLeft, Search, ChevronRight, CreditCard, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import { Badge } from "@/components/ui/badge";

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
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
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

  // Editable paper header fields
  const [examTitle, setExamTitle] = useState("Question Paper");
  const [schoolName, setSchoolName] = useState("");
  const [examDuration, setExamDuration] = useState("2 Hours");
  const [examInstructions, setExamInstructions] = useState("Answer all questions.");
  const [pdfFontReady, setPdfFontReady] = useState(false);

  const { toast } = useToast();

  // Base URLs for services
  const OTP_BASE_URL = "https://772pmv7x-3000.inc1.devtunnels.ms";
  const ADMIN_BASE_URL = "https://08m8v685-3002.inc1.devtunnels.ms";

  const [subjectQuery, setSubjectQuery] = useState("");
  const [boardQuery, setBoardQuery] = useState("");
  const [standardQuery, setStandardQuery] = useState("");
  const [chapterQuery, setChapterQuery] = useState("");
  const [targetTotalMarks, setTargetTotalMarks] = useState<number>(50);
  
  // Payment related state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  
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

    // Build sections (by type) and sub-sections (by difficulty)
    const orderBy = <T extends string>(arr: T[], order: T[]) => {
      const set = new Set(arr);
      const inOrder = order.filter(o => set.has(o));
      const remaining = Array.from(set).filter(x => !order.includes(x)).sort();
      return [...inOrder, ...remaining];
    };
    const allTypes = selectedQuestions.map(q => q.type || '-');
    const sectionTypes = orderBy(allTypes as string[], ['very_short', 'short_answer', 'long_answer', 'mcq', 'true_false', 'fill_blank', 'descriptive', 'Mixed', '-']);
    const difficultyOrder = ['easy', 'medium', 'hard', '-'];

    const sectionLabel = (idx: number) => String.fromCharCode('A'.charCodeAt(0) + idx);

    const makeSectionHTML = () => {
      let qNumber = 1;
      return sectionTypes.map((type, sIdx) => {
        const inSection = selectedQuestions.filter(q => (q.type || '-') === type);
        if (inSection.length === 0) return '';
        const subHTML = orderBy(inSection.map(q => q.difficulty || '-') as string[], difficultyOrder as any)
          .map(diff => {
            const inSub = inSection.filter(q => (q.difficulty || '-') === diff);
            if (inSub.length === 0) return '';
            const items = inSub.map(q => {
              const qText = q.question || (q as any).text || (q as any).content || '[No question text]';
              const marks = Number.isFinite(q.marks) ? q.marks : '-';
              const html = `
                <div style=\"padding-bottom:8px; border-bottom:1px dashed #e5e5e5;\">
                  <div style=\"display:flex; align-items:flex-start; gap:10px;\">
                    <div style=\"min-width:26px; font-weight:700;\">Q${qNumber++}.</div>
                    <div style=\"flex:1; line-height:1.5; font-size:13px;\">${qText}</div>
                    <div style=\"margin-left:8px; font-size:11px; background:#efefef; border:1px solid #ddd; padding:2px 8px; border-radius:12px; white-space:nowrap;\">${marks} Marks</div>
                  </div>
                </div>`;
              return html;
            }).join('');
            const diffTitle = diff === '-' ? '' : ` (${diff.replace('_', ' ')})`;
            return `
              <div style=\"margin-top:6px;\">
                <div style=\"font-weight:600; font-size:12px; color:#333; margin:6px 0;\">${sectionLabel(sIdx)}.${difficultyOrder.indexOf(diff) + 1} ${diffTitle}</div>
                ${items}
              </div>`;
          }).join('');
        const typeTitle = type === '-' ? 'General' : type.replace(/_/g, ' ');
        return `
          <div style=\"margin-top:14px;\">
            <div style=\"font-weight:700; font-size:14px; border-left:4px solid #222; padding-left:8px;\">Section ${sectionLabel(sIdx)}: ${typeTitle}</div>
            ${subHTML}
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

  // Auto-bypass OTP if previously verified on this browser
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("spg_logged_in_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setCurrentStep("boards");
        toast({ title: "Welcome back", description: "Logged in from previous session." });
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

    // Questions
    selectedQuestions.forEach((question, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        try { doc.setFont('NotoSansGujarati'); } catch {}
      }
      doc.setFontSize(12);
      const qText = question.question || (question as any).text || (question as any).content || "[No question text]";
      const split = doc.splitTextToSize(`Q${index + 1}. ${qText}`, 170);
      doc.text(split, 20, y);
      y += split.length * 6;

      doc.setFontSize(9);
      doc.text(`Marks: ${question.marks ?? '-' } • Difficulty: ${question.difficulty ?? '-' } • Type: ${question.type ?? '-' }`, 20, y);
      y += 10;
    });

    const fileName = `${selectedSubject?.name || 'Subject'}_${selectedChapter || 'All'}_Question_Paper.pdf`;
    doc.save(fileName);

    toast({
      title: "PDF Downloaded",
      description: `Question paper saved as ${fileName}`,
    });
  };

  // Helper to normalize question objects from API to our shape
  const normalizeQuestion = (raw: any): Question => {
    const textCandidate = raw?.question ?? raw?.text ?? raw?.content ?? raw?.title ?? raw?.body ?? raw?.questionText;
    const normalized: Question = {
      id: raw?.id ?? raw?._id ?? Math.floor(Math.random() * 1_000_000_000),
      question: typeof textCandidate === 'string' && textCandidate.trim().length > 0 ? textCandidate : "[No question text]",
      type: raw?.type ?? raw?.questionType ?? "-",
      difficulty: raw?.difficulty ?? raw?.level ?? "-",
      chapter: raw?.chapter ?? raw?.chapterName ?? (selectedChapter || "-"),
      marks: Number.isFinite(Number(raw?.marks ?? raw?.mark ?? raw?.points)) ? Number(raw?.marks ?? raw?.mark ?? raw?.points) : 1,
      text: raw?.text,
      content: raw?.content,
    };
    return normalized;
  };

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
      setError(`Failed to load questions from admin panel: ${err}`);
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
      const data = await response.json();
      setChapters(data);
    } catch (err: any) {
      setError("Failed to load chapters from admin panel: " + err.message);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Load boards when component mounts and user reaches boards step
  useEffect(() => {
    if (currentStep === "boards") {
      fetchBoards();
    }
  }, [currentStep]);

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

    // If email already verified on this browser, bypass OTP
    try {
      const savedEmail = localStorage.getItem("spg_logged_in_email");
      if (savedEmail && savedEmail.toLowerCase() === email.trim().toLowerCase()) {
        setIsOtpSent(false);
        setLoading(false);
        setError("");
        setCurrentStep("boards");
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
        setCurrentStep("boards");
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

    // Fetch standards for this board if not already loaded
    if (!standards[board.id]) {
      await fetchStandards(board.id);
    }

    setShowStandardsPopup(true);
  };

  const selectStandard = async (standard: Standard) => {
    setSelectedStandard(standard);
    setShowStandardsPopup(false);

    // Fetch subjects for this standard if not already loaded
    if (!subjects[standard.id]) {
      await fetchSubjects(standard.id);
    }

    setCurrentStep("subjects");
  };

  const selectSubject = async (subject: Subject) => {
    handleSubjectSelection(subject);
  };

  // Helper: generate random paper for current subject
  const createRandomPaper = async () => {
    try {
      if (!selectedSubject?.id) return;
      // Ensure questions for the subject are loaded
      if (!questions[selectedSubject.id]) {
        await fetchQuestions(selectedSubject.id);
      }
      const pool = questions[selectedSubject.id] || [];
      if (pool.length === 0) {
        setError("No questions available to generate a random paper.");
        return;
      }
      const picked = pickQuestionsForTarget(pool, targetTotalMarks);
      setSelectedQuestions(picked);
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
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Select Subject
              </CardTitle>
              <CardDescription>
                {selectedBoard?.name} - {selectedStandard?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("boards")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Board/Standard
              </Button>
            </CardHeader>

            <CardContent className="flex flex-col h-[70vh]">
              {/* Search */}
              <div className="mb-6 max-w-md mx-auto relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search subjects..."
                  value={subjectQuery}
                  onChange={(e) => setSubjectQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {subjects[selectedStandard?.id || 0] ? (
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-4">
                  {subjects[selectedStandard!.id]
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
                        <Card
                          key={index}
                          onClick={() => selectSubject(subjectObj)}
                          className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group h-full"
                        >
                          <CardContent className="p-5 h-full">
                            <div className="flex flex-col items-center text-center gap-3 h-full">
                              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0 w-full">
                                <h3 className="text-base font-semibold whitespace-normal break-words hyphens-auto leading-snug">
                                  {subjectObj.name}
                                </h3>
                              </div>
                              <div className="mt-1 flex flex-col gap-2">
                                {isFree ? (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    <span className="mr-1">✓</span> Free
                                  </Badge>
                                ) : (
                                  <div className="flex items-center gap-1 text-sm font-semibold text-orange-600">
                                    <IndianRupee className="w-3 h-3" />
                                    {subjectObj.price}
                                  </div>
                                )}
                                <Badge variant="secondary" className="text-xs">Subject</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-academic-purple" />
                  <p className="text-muted-foreground mt-2">Loading subjects...</p>
                </div>
              )}
            </CardContent>
          </Card>
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
                    setCurrentStep("chapter-selection");
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
                    setCurrentStep("chapter-selection");
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

  if (currentStep === "chapter-selection") {
    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground mb-2">
                Select Chapter
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

              {chapters.length > 0 ? (
                <div className="space-y-3">
                  {chapters
                    .filter((chapter) => chapter.name.toLowerCase().includes(chapterQuery.trim().toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((chapter, index) => (
                    <Card
                      key={chapter.id || index}
                      onClick={() => {
                        const handleChapterSelect = async () => {
                          setSelectedChapter(chapter.name);
                          if (paperMode === 'random') {
                            // Generate random from this chapter
                            const data = await fetchQuestions(selectedSubject.id!, chapter.name);
                            const pool = data || [];
                            if (pool.length === 0) {
                              setError("No questions available in this chapter.");
                              return;
                            }
                            const picked = pickQuestionsForTarget(pool, targetTotalMarks);
                            setSelectedQuestions(picked);
                            setSelectedQuestionType('Mixed');
                            setCurrentStep("paper-review");
                          } else {
                            await fetchQuestions(selectedSubject.id!, chapter.name);
                            setCurrentStep("question-type-selection");
                          }
                        };
                        handleChapterSelect();
                      }}
                      className="cursor-pointer border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold whitespace-normal break-words leading-snug">
                              {chapter.name}
                            </h3>
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs">Chapter</Badge>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
                    <div className="space-y-4 pb-4">
                      {selectedQuestions.map((question, index) => (
                        <Card key={question.id} className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm sm:text-base">Q{index + 1}</h4>
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
                                  value={question.question}
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
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value || '0', 10);
                                    setSelectedQuestions(prev => prev.map(q => q.id === question.id ? { ...q, marks: value } : q));
                                  }}
                                  className="text-xs sm:text-sm"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Difficulty: {question.difficulty || '-'} • Type: {question.type || '-'}
                            </div>
                          </div>
                        </Card>
                      ))}
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
                          Q{index + 1}. {question.question}
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