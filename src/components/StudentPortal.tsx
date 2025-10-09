import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, BookOpen, GraduationCap, Users, X, ChevronLeft, Search, ChevronRight, CreditCard, IndianRupee, Plus, FileText, ArrowLeft, Home, Calculator, Microscope, Globe, Atom, Beaker, Brain, MapPin, Languages, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { useModal } from "@/contexts/ModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import jsPDF from 'jspdf';
import { Badge } from "@/components/ui/badge";
import LatexPreview from "./LatexPreview";
import ChapterPaper from "./ChapterPaper";
import DifficultyPaper from "./DifficultyPaper";
import RandomPaper from "./RandomPaper";
import katex from "katex";

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
  console.log("StudentPortal component rendering");
  const { isDarkMode } = useDarkMode();
  const { setIsModalOpen } = useModal();
  const { isLoggedIn, setIsLoggedIn, setUserEmail } = useAuth();
  const [currentStep, setCurrentStep] = useState("login");
  console.log("Current step:", currentStep);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | string[] | null>(null);
  const [typeAllocations, setTypeAllocations] = useState<Record<string, number>>({});
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
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [selectedChapterNames, setSelectedChapterNames] = useState<string[]>([]);
  const [showChapterPaper, setShowChapterPaper] = useState(false);
  const [multiChapterLoading, setMultiChapterLoading] = useState(false);

  // Editable paper header fields
  const [examTitle, setExamTitle] = useState("Question Paper");
  const [schoolName, setSchoolName] = useState("");
  const [examDuration, setExamDuration] = useState("2 Hours");
  const [examInstructions, setExamInstructions] = useState("Answer all questions.");
  const [pdfFontReady, setPdfFontReady] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [userPreviousData, setUserPreviousData] = useState<any>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  // Chapter expansion state for dropdowns
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [chapterQuestionTypes, setChapterQuestionTypes] = useState<Record<string, string[]>>({});
  const [loadingTypes, setLoadingTypes] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const navigate = useNavigate();

  // Helper functions for chapter expansion and question type loading
  const loadQuestionTypes = async (chapterName: string) => {
    if (chapterQuestionTypes[chapterName]?.length > 0) return; // Already loaded
    
    setLoadingTypes(prev => ({ ...prev, [chapterName]: true }));
    try {
      const questions = await fetchQuestions(selectedSubject.id!, chapterName);
      const types = [...new Set(questions.map(q => q.type))];
      setChapterQuestionTypes(prev => ({ ...prev, [chapterName]: types }));
    } catch (error) {
      console.error("Error loading question types:", error);
    } finally {
      setLoadingTypes(prev => ({ ...prev, [chapterName]: false }));
    }
  };

  const handleChapterClick = (chapterName: string) => {
    if (paperMode === 'chapter') return; // Skip for multi-chapter mode
    
    const isCurrentlyExpanded = expandedChapters[chapterName];
    setExpandedChapters(prev => ({ ...prev, [chapterName]: !isCurrentlyExpanded }));
    
    if (!isCurrentlyExpanded) {
      loadQuestionTypes(chapterName);
    }
  };

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
      
      // Save created papers to admin panel
      const currentEmail = localStorage.getItem("spg_logged_in_email");
      if (currentEmail) {
        updateUserProfileInAdmin(currentEmail, { createdPapers: savedPapers }, selectedBoard, selectedStandard);
      }
      
      // Send paper creation activity to admin panel
      if (currentEmail) {
        const activityData = {
          username: currentEmail.split('@')[0],
          email: currentEmail,
          firstName: currentEmail.split('@')[0],
          lastName: "Student",
          role: "student",
          status: "active",
          lastActive: new Date().toISOString(),
          // Activity data
          activityType: "paper_created",
          paperDetails: {
            title: paperData.title,
            subject: paperData.subject,
            board: paperData.board,
            standard: paperData.standard,
            type: paperData.type,
            difficulty: paperData.difficulty,
            totalQuestions: paperData.totalQuestions,
            totalMarks: paperData.totalMarks,
            chapters: paperData.chapters
          },
          activityDate: new Date().toISOString(),
          isNewUser: false
        };
        
        // Send to admin panel asynchronously
        sendUserDataToAdmin(activityData);
      }
      
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
    setLoadingSubjects(true);
    
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
      setLoadingSubjects(false);
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
  

  // Function to get subject-specific icon
  const getSubjectIcon = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    
    if (name.includes('math') || name.includes('mathematics')) {
      return <Calculator className="w-6 h-6 text-black" />;
    } else if (name.includes('english')) {
      return <Languages className="w-6 h-6 text-black" />;
    } else if (name.includes('gujarati') || name.includes('hindi') || name.includes('language')) {
      return <BookOpen className="w-6 h-6 text-black" />;
    } else if (name.includes('biology') || name.includes('science - biology')) {
      return <Brain className="w-6 h-6 text-black" />;
    } else if (name.includes('chemistry') || name.includes('science - chemistry')) {
      return <Beaker className="w-6 h-6 text-black" />;
    } else if (name.includes('physics') || name.includes('science - physics')) {
      return <Atom className="w-6 h-6 text-black" />;
    } else if (name.includes('science')) {
      return <Microscope className="w-6 h-6 text-black" />;
    } else if (name.includes('social') || name.includes('history') || name.includes('geography')) {
      return <Globe className="w-6 h-6 text-black" />;
    } else {
      return <BookOpen className="w-6 h-6 text-black" />;
    }
  };

  // Function to get subject-specific background color
  const getSubjectColor = (subjectName: string) => {
    const name = subjectName.toLowerCase();
    
    if (name.includes('math') || name.includes('mathematics')) {
      return 'bg-gradient-to-br from-blue-500 to-blue-600';
    } else if (name.includes('english')) {
      return 'bg-gradient-to-br from-purple-500 to-purple-600';
    } else if (name.includes('gujarati') || name.includes('hindi') || name.includes('language')) {
      return 'bg-gradient-to-br from-green-500 to-green-600';
    } else if (name.includes('biology') || name.includes('science - biology')) {
      return 'bg-gradient-to-br from-pink-500 to-pink-600';
    } else if (name.includes('chemistry') || name.includes('science - chemistry')) {
      return 'bg-gradient-to-br from-orange-500 to-orange-600';
    } else if (name.includes('physics') || name.includes('science - physics')) {
      return 'bg-gradient-to-br from-indigo-500 to-indigo-600';
    } else if (name.includes('science')) {
      return 'bg-gradient-to-br from-teal-500 to-teal-600';
    } else if (name.includes('social') || name.includes('history') || name.includes('geography')) {
      return 'bg-gradient-to-br from-amber-500 to-amber-600';
    } else {
      return 'bg-gradient-to-br from-gray-500 to-gray-600';
    }
  };

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

  // Convert $...$ and $$...$$ segments to KaTeX HTML for PDF HTML rendering
  const latexToHtml = (text: string): string => {
    if (!text) return "";
    const parts = text.split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g);
    const html = parts.map((part) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const latexContent = part.slice(2, -2).trim();
        try {
          return katex.renderToString(latexContent, { displayMode: true, throwOnError: false });
        } catch {
          return part;
        }
      } else if (part.startsWith("$") && part.endsWith("$")) {
        const latexContent = part.slice(1, -1).trim();
        try {
          return katex.renderToString(latexContent, { displayMode: false, throwOnError: false });
        } catch {
          return part;
        }
      }
      return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }).join("");
    return html;
  };

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
              const qHtml = latexToHtml(qText);
              const marks = Number.isFinite(q.marks) ? q.marks : '-';
              return `
                <div style=\"padding-bottom:8px; border-bottom:1px dashed #e5e5e5;\">\
                  <div style=\"display:flex; align-items:flex-start; gap:10px;\">\
                    <div style=\"min-width:26px; font-weight:700;\">Q${qNumber++}.</div>
                    <div style=\"flex:1; line-height:1.5; font-size:13px;\">${qHtml}</div>
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
          const qHtml = latexToHtml(qText);
          const marks = Number.isFinite(q.marks) ? q.marks : '-';
          const html = `
            <div style=\"padding-bottom:8px; border-bottom:1px dashed #e5e5e5;\">\
              <div style=\"display:flex; align-items:flex-start; gap:10px;\">\
                <div style=\"min-width:26px; font-weight:700;\">Q${qNumber++}.</div>
                <div style=\"flex:1; line-height:1.5; font-size:13px;\">${qHtml}</div>
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
        ${examInstructions ? `<div style=\"margin-top:12px; font-size:12px; border:1px solid #ddd; padding:10px; border-radius:6px; background:#fafafa;\"><strong>Instructions:</strong> ${latexToHtml(examInstructions)}</div>` : ''}
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
            setCurrentStep("subjects");
            toast({ title: "Welcome back", description: "Logged in from previous session." });
          }
        } else {
          setCurrentStep("subjects");
          toast({ title: "Welcome back", description: "Logged in from previous session." });
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Payment functions
  // Prefer environment configuration, but fall back to existing defaults
  const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'https://08m8v685-3002.inc1.devtunnels.ms';
  const razorpayKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag';
  const paymentsMode = (import.meta as any).env?.VITE_PAYMENTS_MODE || 'auto'; // 'auto' | 'client' | 'server'
  const initiatePayment = async (subject: Subject) => {
    if (!razorpayLoaded) {
      toast({ title: "Payment Error", description: "Payment system is not ready. Please try again." });
      return;
    }

    setPaymentLoading(true);
    try {
      console.log('Creating payment order for:', subject);

      let orderData: any = null;

      if (paymentsMode !== 'client') {
        // Attempt server order creation when not forced client mode
        try {
          const orderResponse = await fetch(`${apiBaseUrl}/api/create-order`, {
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

          if (orderResponse.ok && orderResponse.headers.get('content-type')?.includes('application/json')) {
            orderData = await orderResponse.json();
            console.log('Order data received:', orderData);
          } else {
            // Non-JSON or non-OK: fall back to client mode silently
            console.warn('Backend order creation unavailable or returned non-JSON. Falling back to client checkout.');
          }
        } catch (serverErr) {
          console.warn('Order creation request failed. Falling back to client checkout.', serverErr);
        }
      }

      // Build Razorpay checkout options. Only include order_id when provided by backend
      const options: any = {
        key: razorpayKey,
        amount: (subject.price || 0) * 100, // Convert to paise
        currency: 'INR',
        name: 'Study Path Genie',
        description: `Payment for ${subject.name}`,
        retry: { enabled: false },
        handler: async function (response: any) {
          console.log('Payment successful:', response);
          
          try {
            // Verify payment on your backend
            const verifyResponse = await fetch(`${apiBaseUrl}/api/verify-payment`, {
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
              // Persist purchase to localStorage
              try {
                const existing = JSON.parse(localStorage.getItem('spg_purchases') || '[]');
                const already = Array.isArray(existing) && existing.some((it: any) => it?.id === subject.id);
                const updated = already ? existing : [...existing, { id: subject.id, name: subject.name, price: subject.price }];
                localStorage.setItem('spg_purchases', JSON.stringify(updated));
              } catch {}
              
              // Update user's purchased subjects in API (email endpoint)
              const currentEmail = localStorage.getItem("spg_logged_in_email");
              if (currentEmail) {
                postPurchasedSubject(currentEmail, subject.id, subject.name);
              }
              
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

      if (orderData?.id) {
        options.order_id = orderData.id; // only attach when backend returned a valid order
      }

      console.log('Opening Razorpay with options:', options);
      const razorpay = new window.Razorpay(options);
      // Handle failures explicitly to avoid unhandled console noise
      try {
        razorpay.on && razorpay.on('payment.failed', function (response: any) {
          console.error('Payment failed:', response?.error || response);
          toast({ title: "Payment Failed", description: response?.error?.description || 'Payment was not completed.' });
          setPaymentLoading(false);
        });
      } catch {}
      razorpay.open();
      
    } catch (error) {
      console.error('Payment error:', error);
      
      // If API fails, offer fallback payment option
      if (paymentsMode === 'client' || (error instanceof Error && error.message.includes('API endpoint may not exist'))) {
        toast({ 
          title: "API Not Available", 
          description: "Backend API is not available. Using test payment mode.",
          duration: 5000
        });
        
        // Fallback: Create payment without backend API
        try {
          const options: any = {
            key: razorpayKey,
            amount: (subject.price || 0) * 100,
            currency: 'INR',
            name: 'Study Path Genie',
            description: `Payment for ${subject.name}`,
            retry: { enabled: false },
            handler: function (response: any) {
              console.log('Fallback payment successful:', response);
              toast({ title: "Payment Successful", description: `Access granted to ${subject.name}` });
              // Persist purchase to localStorage (test mode)
              try {
                const existing = JSON.parse(localStorage.getItem('spg_purchases') || '[]');
                const already = Array.isArray(existing) && existing.some((it: any) => it?.id === subject.id);
                const updated = already ? existing : [...existing, { id: subject.id, name: subject.name, price: subject.price }];
                localStorage.setItem('spg_purchases', JSON.stringify(updated));
              } catch {}
              
              // Update user's purchased subjects in API (email endpoint)
              const currentEmail = localStorage.getItem("spg_logged_in_email");
              if (currentEmail) {
                postPurchasedSubject(currentEmail, subject.id, subject.name);
              }
              
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

          // Do not include order_id in fallback mode; checkout can proceed without it for test
          const razorpay = new window.Razorpay(options);
          try {
            razorpay.on && razorpay.on('payment.failed', function (response: any) {
              console.error('Payment failed:', response?.error || response);
              toast({ title: "Payment Failed", description: response?.error?.description || 'Payment was not completed.' });
              setPaymentLoading(false);
            });
          } catch {}
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
    // If subject is already purchased, bypass payment - ONLY check API, never localStorage
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    let isAlreadyPurchased = false;
    
    // ONLY check API data, never localStorage
    if (currentEmail && userPreviousData && userPreviousData.purchasedSubjects) {
      isAlreadyPurchased = isSubjectPurchased(subject.id, userPreviousData.purchasedSubjects);
      console.log(`🔍 Subject ${subject.name} (ID: ${subject.id}) - Already purchased check: ${isAlreadyPurchased}`);
    } else {
      // If no API data, assume NOT purchased
      isAlreadyPurchased = false;
      console.log(`🔍 Subject ${subject.name} (ID: ${subject.id}) - No API data, assuming NOT purchased`);
    }
    
    if (isAlreadyPurchased) {
        setSelectedSubject(subject);
        setCurrentStep("paper-options");
        return;
      }

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

    const hasLatex = /(\$\$[^$]+\$\$|\$[^$]+\$)/.test(fullText);
    if (containsComplexScript(fullText) || hasLatex) {
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

  // Fetch boards from API
  const fetchBoards = async () => {
    setLoadingBoards(true);
    setError("");
    
    try {
      console.log("🔄 Fetching boards from API...");
      const response = await fetch(`${ADMIN_BASE_URL}/api/boards`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch boards: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Boards fetched successfully:", data);
      setBoards(data);
      setIsOfflineMode(false);
    } catch (error) {
      console.error("❌ Error fetching boards:", error);
      setError("Failed to load boards. Please check your connection and try again.");
      
      // Fallback to sample data if API fails
      console.log("ℹ️ Falling back to sample data");
      setBoards([
        { id: 1, name: "CBSE", description: "Central Board of Secondary Education" },
        { id: 2, name: "ICSE", description: "Indian Certificate of Secondary Education" },
        { id: 3, name: "State Board", description: "State Board Education" },
        { id: 4, name: "IB", description: "International Baccalaureate" },
      ]);
      setIsOfflineMode(true);
    } finally {
      setLoadingBoards(false);
    }
  };

  // Fetch standards for selected board from API
  const fetchStandards = async (boardId: number) => {
    try {
      console.log("🔄 Fetching standards from API for board:", boardId);
      const response = await fetch(`${ADMIN_BASE_URL}/api/boards/${boardId}/standards`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch standards: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Standards fetched successfully:", data);
      setStandards((prev) => ({
        ...prev,
        [boardId]: data,
      }));
    } catch (error) {
      console.error("❌ Error fetching standards:", error);
      
      // Fallback to sample data if API fails
      console.log("ℹ️ Falling back to sample standards data");
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

  // Fetch subjects for selected standard from API
  const fetchSubjects = async (standardId: number) => {
    setError("");
    
    try {
      console.log("🔄 Fetching subjects from API for standard:", standardId);
      const response = await fetch(`${ADMIN_BASE_URL}/api/standards/${standardId}/subjects`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch subjects: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Subjects fetched successfully:", data);
      setSubjects((prev) => ({
        ...prev,
        [standardId]: data,
      }));
    } catch (error) {
      console.error("❌ Error fetching subjects:", error);
      setError("Failed to load subjects. Please check your connection and try again.");
      
      // Fallback to sample data if API fails
      console.log("ℹ️ Falling back to sample subjects data");
      const sampleSubjects = [
        { id: 1, name: "Mathematics", price: 0 },
        { id: 2, name: "Physics", price: 0 },
        { id: 3, name: "Chemistry", price: 0 },
        { id: 4, name: "Biology", price: 0 },
        { id: 5, name: "English", price: 0 },
        { id: 6, name: "Computer Science", price: 0 },
        { id: 999, name: "Premium Mathematics", price: 299 }
      ];
      
      setSubjects((prev) => ({
        ...prev,
        [standardId]: sampleSubjects,
      }));
    }
  };

  // Fetch questions for selected subject from API
  const fetchQuestions = async (subjectId: number, chapterName?: string) => {
    setLoadingQuestions(true);
    setError("");
    
    try {
      console.log("🔄 Fetching questions from API for subject:", subjectId);
      const response = await fetch(`${ADMIN_BASE_URL}/api/subjects/${subjectId}/questions`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText}`);
      }
      
      // Check if response is actually JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Expected JSON but received:", contentType, text.substring(0, 200));
        throw new Error("Server returned HTML instead of JSON. API endpoint may not exist or server error occurred.");
      }
      
      const data = await response.json();
      console.log("✅ Questions fetched successfully:", data);
      
      const normalized = data.map(normalizeQuestion);
      if (chapterName) {
        setChapterQuestions(normalized);
      } else {
        setQuestions((prev) => ({
          ...prev,
          [subjectId]: normalized,
        }));
      }
      return normalized as Question[];
    } catch (error) {
      console.error("❌ Error fetching questions:", error);
      setError("Failed to load questions. Please check your connection and try again.");
      
      // Fallback to sample data if API fails
      console.log("ℹ️ Falling back to sample questions data");
      const sampleQuestions = [
        {
          id: 1,
          question: "What is the derivative of x²?",
          type: "Short Answer",
          difficulty: "Easy",
          chapter: chapterName || "Calculus",
          marks: 2,
          text: "What is the derivative of x²?",
          content: "What is the derivative of x²?"
        },
        {
          id: 2,
          question: "Solve the equation: 2x + 5 = 13",
          type: "Short Answer",
          difficulty: "Easy",
          chapter: chapterName || "Algebra",
          marks: 3,
          text: "Solve the equation: 2x + 5 = 13",
          content: "Solve the equation: 2x + 5 = 13"
        },
        {
          id: 3,
          question: "Explain the concept of photosynthesis.",
          type: "Long Answer",
          difficulty: "Medium",
          chapter: chapterName || "Biology",
          marks: 5,
          text: "Explain the concept of photosynthesis.",
          content: "Explain the concept of photosynthesis."
        },
        {
          id: 4,
          question: "What is the capital of India?",
          type: "MCQ",
          difficulty: "Easy",
          chapter: chapterName || "General Knowledge",
          marks: 1,
          text: "What is the capital of India?",
          content: "What is the capital of India?"
        },
        {
          id: 5,
          question: "Calculate the area of a circle with radius 7 cm.",
          type: "Problem Solving",
          difficulty: "Medium",
          chapter: chapterName || "Geometry",
          marks: 4,
          text: "Calculate the area of a circle with radius 7 cm.",
          content: "Calculate the area of a circle with radius 7 cm."
        }
      ];
      
      const normalized = sampleQuestions.map(normalizeQuestion);
      if (chapterName) {
        setChapterQuestions(normalized);
      } else {
        setQuestions((prev) => ({
          ...prev,
          [subjectId]: normalized,
        }));
      }
      return normalized as Question[];
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Fetch chapters for selected subject from API
  const fetchChapters = async (subjectId: number) => {
    setLoadingChapters(true);
    setError("");
    
    try {
      console.log("🔄 Fetching chapters from API for subject:", subjectId);
      const response = await fetch(`${ADMIN_BASE_URL}/api/subjects/${subjectId}/chapters`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chapters: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("✅ Chapters fetched successfully:", data);
      setChapters(data);
    } catch (error) {
      console.error("❌ Error fetching chapters:", error);
      setError("Failed to load chapters. Please check your connection and try again.");
      
      // Fallback to sample data if API fails
      console.log("ℹ️ Falling back to sample chapters data");
      const sampleChapters = [
        { id: 1, name: "Introduction", subjectId: subjectId },
        { id: 2, name: "Fundamentals", subjectId: subjectId },
        { id: 3, name: "Advanced Topics", subjectId: subjectId },
        { id: 4, name: "Applications", subjectId: subjectId },
        { id: 5, name: "Practice Problems", subjectId: subjectId }
      ];
      
      setChapters(sampleChapters);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Load boards when component mounts
  useEffect(() => {
    fetchBoards();
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    if (isLoggedIn) {
      // If user is logged in, check if they have saved board/standard preferences
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
          setCurrentStep("subjects");
        }
      } catch {
        setCurrentStep("subjects");
      }
    }
  }, [isLoggedIn]);

  // Handle modal state for boards step
  useEffect(() => {
    if (currentStep === "boards") {
      setIsModalOpen(true);
      setShowBoardsPopup(true);
    } else {
      setShowBoardsPopup(false);
    }
  }, [currentStep, setIsModalOpen]);

  // Handle modal state for standards step
  useEffect(() => {
    if (currentStep === "standards") {
      setIsModalOpen(true);
      setShowStandardsPopup(true);
    } else {
      setShowStandardsPopup(false);
    }
  }, [currentStep, setIsModalOpen]);

  // Function to select a board
  const selectBoard = (board: Board) => {
    setSelectedBoard(board);
    setShowBoardsPopup(false);
    setShowStandardsPopup(true);
    setCurrentStep("standards");
    // Load standards for the selected board
    fetchStandards(board.id);
    
    // Save board selection to localStorage
    localStorage.setItem("spg_selected_board", JSON.stringify(board));
    
    // Save board selection to admin panel with board ID
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    if (currentEmail) {
      updateUserProfileInAdmin(currentEmail, { 
        selectedBoard: board,
        boardId: board.id  // Send board ID
      }, board, selectedStandard);
    }
  };

  // Function to select a standard
  const selectStandard = (standard: Standard) => {
    setSelectedStandard(standard);
    setShowStandardsPopup(false);
    setIsModalOpen(false);
    setCurrentStep("subjects");
    
    // Save standard selection to localStorage
    localStorage.setItem("spg_selected_standard", JSON.stringify(standard));
    
    // Save standard selection to admin panel with standard ID
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    if (currentEmail) {
      updateUserProfileInAdmin(currentEmail, { 
        selectedStandard: standard,
        standardId: standard.id  // Send standard ID
      }, selectedBoard, standard);
    }
  };

  // Function to save user activity to admin panel
  const saveUserActivity = async (activity: string, details?: any) => {
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    if (!currentEmail) return;
    
    const activityData = {
      email: currentEmail,
      activity: activity,
      details: details || {},
      timestamp: new Date().toISOString(),
      deviceInfo: navigator.userAgent,
      ipAddress: "unknown", // Would need backend to get real IP
      // Include current board and standards data
      selectedBoard: selectedBoard,
      selectedStandard: selectedStandard,
      boardId: selectedBoard?.id || null,
      standardId: selectedStandard?.id || null,
      boardName: selectedBoard?.name || null,
      standardName: selectedStandard?.name || null
    };
    
    try {
      await fetch(`${ADMIN_BASE_URL}/api/users/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activityData),
      });
    } catch (error) {
      console.error("Failed to save user activity:", error);
    }
  };

  // Function to logout
  const logout = async () => {
    // Save logout activity
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    if (currentEmail) {
      await saveUserActivity("logout");
    }
    
    // Clear any persisted auth/session and selections
    try {
      localStorage.removeItem("spg_logged_in_email");
      localStorage.removeItem("spg_selected_board");
      localStorage.removeItem("spg_selected_standard");
      localStorage.removeItem("spg_purchases");
    } catch {}
    
    setIsLoggedIn(false);
    setUserEmail(null);
    setCurrentStep("login");
    setEmail("");
    setOtp("");
    setIsOtpSent(false);
    setSelectedBoard(null);
    setSelectedStandard(null);
    setSelectedSubject(null);
    setUserPreviousData(null);
    setShowPaymentModal(false);
    setIsModalOpen(false);
    setError("");

    // Optionally ensure top of view
    try { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); } catch {}
  };

  // Function to select a subject
  const selectSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setCurrentStep("paper-options");
    
    // Save subject selection activity
    const currentEmail = localStorage.getItem("spg_logged_in_email");
    if (currentEmail) {
      saveUserActivity("subject_selected", { subject: subject.name });
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

  // Restore board and standard selections from localStorage on mount and when returning from other pages
  useEffect(() => {
    try {
      const savedBoard = localStorage.getItem("spg_selected_board");
      const savedStandard = localStorage.getItem("spg_selected_standard");
      
      if (savedBoard && !selectedBoard) {
        const board = JSON.parse(savedBoard);
        setSelectedBoard(board);
        console.log("✅ Board restored from localStorage:", board);
      }
      
      if (savedStandard && !selectedStandard) {
        const standard = JSON.parse(savedStandard);
        setSelectedStandard(standard);
        console.log("✅ Standard restored from localStorage:", standard);
      }
    } catch (error) {
      console.error("Error restoring selections from localStorage:", error);
    }
  }, [currentStep, selectedBoard, selectedStandard]);

  // Force refresh user's purchased subjects when reaching subjects page
  useEffect(() => {
    if (currentStep === "subjects") {
      const currentEmail = localStorage.getItem("spg_logged_in_email");
      if (currentEmail) {
        console.log("🔄 User reached subjects page, refreshing purchased subjects...");
        refreshUserPurchasedSubjects();
      }
    }
  }, [currentStep]);

  const sendOtp = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 6) {
      setError("Please enter a password (minimum 6 characters)");
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
        setCurrentStep("subjects");
        toast({ title: "Welcome back", description: "Logged in without OTP." });
        return;
      }
    } catch {
      // ignore storage errors and continue with OTP flow
    }

    setLoading(true);
    setIsCheckingUser(true);
    setError("");

    try {
      // First, check if user exists in admin panel
      console.log("🔍 DEBUG: Starting user check for email:", email);
      const userCheck = await checkUserExists(email);
      console.log("🔍 DEBUG: User check result:", userCheck);
      
      setUserExists(userCheck.exists);
      console.log("🔍 DEBUG: userExists state set to:", userCheck.exists);
      
      if (userCheck.exists) {
        // User exists - use the userData from the check result
        console.log("👤 Existing user detected, using user data from check result");
        if (userCheck.userData) {
          setUserPreviousData(userCheck.userData);
          console.log("✅ User data loaded from check result:", userCheck.userData);
        } else {
          // Fallback: fetch their previous data
          console.log("🔄 Fetching additional user profile data...");
          const userProfile = await fetchUserProfileFromAdmin(email);
          if (userProfile) {
            setUserPreviousData(userProfile);
            console.log("✅ Previous user data loaded:", userProfile);
          }
        }
      } else {
        // User doesn't exist - will create new user after OTP verification
        console.log("🆕 New user detected");
        setUserPreviousData(null);
      }

      // Send OTP regardless of user existence
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
        setIsCheckingUser(false);
        
        // Save OTP timestamp to enforce cooldown
        try {
          const key = `spg_last_otp_ts_${email.trim().toLowerCase()}`;
          localStorage.setItem(key, String(Date.now()));
        } catch {}
        
        // Show appropriate message based on user existence
        const message = userCheck.exists 
          ? "Welcome back! Please check your email for the verification code."
          : "Welcome! Please check your email for the verification code.";
          
        toast({
          title: userCheck.exists ? "OTP Sent - Returning User" : "OTP Sent - New User",
          description: message,
        });
        return;
      } else {
        setError("Could not connect to OTP service. Please check if the server is running and accessible.");
        setLoading(false);
        setIsCheckingUser(false);
      }
    } catch (err) {
      setError("Could not connect to OTP service. Please check if the server is running and accessible.");
      setLoading(false);
      setIsCheckingUser(false);
    }
  };

  // Function to check if user is new (based on admin panel, not localStorage)
  const isNewUser = (email: string) => {
    // This should be based on userExists from admin panel, not localStorage
    return userExists === false;
  };


  // Function to send user data to admin panel
  const sendUserDataToAdmin = async (userData: any, boardData?: Board | null, standardData?: Standard | null, purchasedSubjects?: any[]) => {
    try {
      // Send user-provided data with user-selected board and standard IDs
      const completeUserData = {
        username: userData.email.split('@')[0], // Use email prefix as username
        password: userData.password, // User-provided password
        email: userData.email, // User-provided email
        firstName: userData.email.split('@')[0], // Use email prefix as firstName
        lastName: "Student", // Default lastName
        role: "user", // Use "user" role as in PowerShell example
        selectedBoardId: boardData?.id || null, // User-selected board ID
        selectedStandardId: standardData?.id || null, // User-selected standard ID
        purchasedSubjects: purchasedSubjects || [] // User's purchased subjects or empty array
      };
      
      console.log("🔄 Sending user-provided data with user-selected board/standard and purchased subjects:", completeUserData);
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(completeUserData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ User data sent successfully:", result);
        return result;
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to send user data:", response.status, response.statusText);
        console.error("❌ Error details:", errorText);
        return null;
      }
    } catch (error) {
      console.error("❌ Error sending user data:", error);
      return null;
    }
  };

  // Test function to create a user with board and standards data
  const testCreateUser = async () => {
    const randomId = Math.floor(Math.random() * 10000);
    const testUser = {
      username: `testuser${randomId}`,
      password: `testpass${randomId}`,
      email: `testuser${randomId}@example.com`,
      firstName: "Test",
      lastName: "User",
      role: "student",
      status: "active",
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    
    // Create sample board and standard data for testing
    const testBoard = {
      id: 1,
      name: "CBSE",
      description: "Central Board of Secondary Education"
    };
    
    const testStandard = {
      id: 10,
      name: "Class 10",
      description: "Tenth Standard"
    };
    
    console.log("🧪 Testing user creation with board and standards:", {
      user: testUser,
      board: testBoard,
      standard: testStandard
    });
    
    // Log the complete data that will be sent
    const completeUserData = {
      ...testUser,
      selectedBoard: testBoard,
      selectedStandard: testStandard,
      boardId: testBoard.id,
      standardId: testStandard.id,
      boardName: testBoard.name,
      standardName: testStandard.name
    };
    
    console.log("📤 Complete data being sent to API:", completeUserData);
    
    const result = await sendUserDataToAdmin(testUser, testBoard, testStandard);
    
    if (result) {
      toast({
        title: "✅ User Created!",
        description: `User ${testUser.email} created successfully with board and standards!`,
      });
      
      // Immediately fetch the created user to verify the data
      setTimeout(async () => {
        console.log("🔍 Verifying created user data...");
        await fetchAndDisplayUserData(testUser.email);
      }, 1000);
    } else {
      toast({
        title: "❌ Creation Failed",
        description: "Failed to create user. Check console for details.",
        variant: "destructive"
      });
    }
  };

  // Function to create a new user with complete board and standards data
  const createNewUserWithBoardAndStandards = async (email: string, password: string, board: Board, standard: Standard) => {
    try {
      const userDetails = {
        username: email.split('@')[0],
        password: password,
        email: email,
        firstName: email.split('@')[0],
        lastName: "Student",
        role: "student",
        status: "active",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      
      console.log("🔄 Creating new user with complete data:", {
        user: userDetails,
        board: board,
        standard: standard
      });
      
      // Send new user data to admin panel with board and standards
      const adminResult = await sendUserDataToAdmin(userDetails, board, standard);
      
      if (adminResult) {
        console.log("✅ New user created successfully with board and standards");
        
        // Save user session
        localStorage.setItem("spg_logged_in_email", email);
        setUserEmail(email);
        setIsLoggedIn(true);
        
        // Save board and standard selections
        setSelectedBoard(board);
        setSelectedStandard(standard);
        localStorage.setItem("spg_selected_board", JSON.stringify(board));
        localStorage.setItem("spg_selected_standard", JSON.stringify(standard));
        
        // Save user activity
        await saveUserActivity("user_created", {
          boardId: board.id,
          standardId: standard.id,
          boardName: board.name,
          standardName: standard.name
        });
        
        toast({
          title: "✅ User Created Successfully!",
          description: `User ${email} created with ${board.name} - ${standard.name}`,
        });
        
        return { success: true, user: adminResult };
      } else {
        console.error("❌ Failed to create user in admin panel");
        toast({
          title: "❌ User Creation Failed",
          description: "Failed to create user in admin panel",
          variant: "destructive"
        });
        return { success: false, error: "Failed to create user in admin panel" };
      }
    } catch (error) {
      console.error("❌ Error creating new user:", error);
      toast({
        title: "❌ User Creation Failed",
        description: "An error occurred while creating the user",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    }
  };

  // Function to check if a subject is purchased by the user
  const isSubjectPurchased = (subjectId: number, userPurchasedSubjects: any[]) => {
    if (!userPurchasedSubjects || !Array.isArray(userPurchasedSubjects)) {
      return false;
    }
    return userPurchasedSubjects.some((subject: any) => subject.id === subjectId);
  };

  // Function to refresh user's purchased subjects from API
  const refreshUserPurchasedSubjects = async () => {
    try {
      const currentEmail = localStorage.getItem("spg_logged_in_email");
      if (!currentEmail) {
        console.log("❌ No logged in email found");
        return;
      }

      console.log("🔄 Refreshing user's purchased subjects from API...");
      const userProfile = await fetchUserProfileFromAdmin(currentEmail);
      
      if (userProfile) {
        setUserPreviousData(userProfile);
        console.log("✅ User's purchased subjects refreshed:", userProfile.purchasedSubjects);
        
        // Also update localStorage to keep it in sync
        if (userProfile.purchasedSubjects && userProfile.purchasedSubjects.length > 0) {
          localStorage.setItem('spg_purchases', JSON.stringify(userProfile.purchasedSubjects));
        } else {
          localStorage.setItem('spg_purchases', JSON.stringify([]));
        }
      } else {
        console.log("❌ User profile not found in API - user may not exist");
        // Set empty purchased subjects if user doesn't exist
        setUserPreviousData({ purchasedSubjects: [] });
        localStorage.setItem('spg_purchases', JSON.stringify([]));
      }
    } catch (error) {
      console.error("❌ Error refreshing user's purchased subjects:", error);
      // If API fails, assume no purchased subjects
      setUserPreviousData({ purchasedSubjects: [] });
      localStorage.setItem('spg_purchases', JSON.stringify([]));
    }
  };

  // Function to update user's purchased subjects
  const updateUserPurchasedSubjects = async (email: string, subjectId: number, subjectName: string) => {
    try {
      // First, get current user data to see existing purchased subjects
      const currentUserResponse = await fetch(`${ADMIN_BASE_URL}/api/users`);
      
      if (currentUserResponse.ok) {
        const allUsers = await currentUserResponse.json();
        const currentUserData = allUsers.find((u: any) => u.email === email);
        
        if (!currentUserData) {
          console.error("❌ User not found:", email);
          toast({
            title: "❌ User Not Found",
            description: "User not found in API",
          });
          return;
        }
        
        const existingPurchasedSubjects = currentUserData.purchasedSubjects || [];
        
        // Check if subject is already purchased
        const alreadyPurchased = isSubjectPurchased(subjectId, existingPurchasedSubjects);
        
        if (alreadyPurchased) {
          console.log("📚 Subject already purchased:", subjectName);
          toast({
            title: "📚 Already Purchased",
            description: `You have already purchased ${subjectName}`,
          });
          return;
        }
        
        // Add new subject to purchased subjects
        const updatedPurchasedSubjects = [
          ...existingPurchasedSubjects,
          { id: subjectId, name: subjectName }
        ];
        
        // Update user with new purchased subjects
        const updateData = {
          purchasedSubjects: updatedPurchasedSubjects
        };
        
        console.log("🔄 Updating user's purchased subjects:", {
          email: email,
          newSubject: { id: subjectId, name: subjectName },
          allPurchasedSubjects: updatedPurchasedSubjects
        });
        
        const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, ...updateData }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log("✅ User's purchased subjects updated successfully:", result);
          
          toast({
            title: "✅ Subject Purchased!",
            description: `${subjectName} has been added to your purchased subjects!`,
          });
          
          // Refresh the UI to show the subject as unlocked
          window.location.reload();
          
          return result;
        } else {
          const errorText = await response.text();
          console.error("❌ Failed to update purchased subjects:", response.status, response.statusText);
          console.error("❌ Error details:", errorText);
          
          // Try to parse error response for more details
          let errorMessage = `Failed to update purchased subjects: ${response.status} ${response.statusText}`;
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (e) {
            // Use default error message if JSON parsing fails
          }
          
          toast({
            title: "❌ Update Error",
            description: errorMessage,
            variant: "destructive"
          });
          
          // Still update localStorage as fallback
          try {
            const currentPurchases = JSON.parse(localStorage.getItem('spg_purchases') || '[]');
            const updatedPurchases = [...currentPurchases, { id: subjectId, name: subjectName }];
            localStorage.setItem('spg_purchases', JSON.stringify(updatedPurchases));
            console.log("💾 Updated localStorage as fallback:", updatedPurchases);
          } catch (localError) {
            console.error("❌ Failed to update localStorage:", localError);
          }
          
          return null;
        }
      } else {
        console.error("❌ Failed to fetch current user data:", currentUserResponse.status, currentUserResponse.statusText);
        toast({
          title: "❌ Fetch Failed",
          description: "Failed to fetch current user data",
          variant: "destructive"
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error updating purchased subjects:", error);
      toast({
        title: "❌ Update Error",
        description: "An error occurred while updating purchased subjects",
        variant: "destructive"
      });
      return null;
    }
  };

  // Function to POST a purchased subject to /api/users/email/:email/subjects
  const postPurchasedSubject = async (email: string, subjectId: number, subjectName: string) => {
    try {
      const payload = { subjectId, subjectName };
      console.log("🧾 Posting purchased subject to API:", { email, ...payload });
      const response = await fetch(`${ADMIN_BASE_URL}/api/users/email/${encodeURIComponent(email)}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        console.log("✅ Subject posted successfully:", result);
        toast({
          title: "✅ Subject Purchased!",
          description: `${subjectName} has been added to your purchased subjects!`,
        });
        // Refresh from API so UI reflects latest state
        await refreshUserPurchasedSubjects();
        return result;
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to post purchased subject:", response.status, response.statusText);
        console.error("❌ Error details:", errorText);
        let errorMessage = `Failed to add subject: ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.message) errorMessage = parsed.message;
        } catch {}
        toast({ title: "❌ Update Error", description: errorMessage, variant: "destructive" });
        return null;
      }
    } catch (error) {
      console.error("❌ Error posting purchased subject:", error);
      toast({ title: "❌ Update Error", description: "Failed to add purchased subject", variant: "destructive" });
      return null;
    }
  };

  // Function to test direct API call with user-provided data
  const testDirectAPICall = async () => {
    try {
      // Use actual user-provided data from the form or get from existing users
      const currentLoggedInEmail = localStorage.getItem("spg_logged_in_email");
      const userEmail = email || currentLoggedInEmail;
      
      if (!userEmail) {
        toast({
          title: "❌ No User Email",
          description: "Please log in first or provide an email in the form",
          variant: "destructive"
        });
        return;
      }
      
      const userPassword = password || "testpass123";
      const userFirstName = userEmail.split('@')[0];
      
      // Use user-selected board and standard IDs
      const userSelectedBoardId = selectedBoard?.id || 2;
      const userSelectedStandardId = selectedStandard?.id || 4;
      
      const testUser = {
        username: userEmail.split('@')[0], // User-provided email prefix
        password: userPassword, // User-provided password
        email: userEmail, // User-provided email
        firstName: userFirstName, // User-provided firstName
        lastName: "Student", // Default lastName
        role: "user", // Use "user" role as in PowerShell example
        selectedBoardId: userSelectedBoardId, // User-selected board ID
        selectedStandardId: userSelectedStandardId, // User-selected standard ID
        purchasedSubjects: [] // Empty array for new users
      };
      
      console.log("🧪 Testing with user-provided data and user-selected board/standard:", testUser);
      
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testUser),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ Direct API call successful:", result);
        
        toast({
          title: "✅ Direct API Test Success!",
          description: `User ${testUser.email} created with user-provided data!`,
        });
        
        // Verify the created user
        setTimeout(async () => {
          console.log("🔍 Verifying direct API created user...");
          await fetchAndDisplayUserData(testUser.email);
        }, 1000);
        
        return result;
      } else {
        const errorText = await response.text();
        console.error("❌ Direct API call failed:", response.status, response.statusText);
        console.error("❌ Error details:", errorText);
        
        toast({
          title: "❌ Direct API Test Failed",
          description: `Failed: ${response.status} ${response.statusText}`,
          variant: "destructive"
        });
        
        return null;
      }
    } catch (error) {
      console.error("❌ Error in direct API call:", error);
      toast({
        title: "❌ Direct API Test Error",
        description: "An error occurred during direct API test",
        variant: "destructive"
      });
      return null;
    }
  };

  // Function to update existing user with user-selected board and standards data
  const updateExistingUserWithBoardAndStandards = async (email: string) => {
    try {
      // Use user-selected board and standard IDs
      const userSelectedBoardId = selectedBoard?.id || 2;
      const userSelectedStandardId = selectedStandard?.id || 4;
      
      const updateData = {
        selectedBoardId: userSelectedBoardId, // User-selected board ID
        selectedStandardId: userSelectedStandardId, // User-selected standard ID
        purchasedSubjects: [] // Empty array for now
      };
      
      console.log("🔄 Updating existing user with user-selected board/standard:", {
        email: email,
        updateData: updateData
      });
      
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, ...updateData }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ User updated successfully with user-selected board and standards:", result);
        
        toast({
          title: "✅ User Updated!",
          description: `User ${email} updated with user-selected board/standard!`,
        });
        
        // Verify the updated user
        setTimeout(async () => {
          console.log("🔍 Verifying updated user data...");
          await fetchAndDisplayUserData(email);
        }, 1000);
        
        return result;
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to update user:", response.status, response.statusText);
        console.error("❌ Error details:", errorText);
        
        toast({
          title: "❌ Update Failed",
          description: `Failed to update user: ${response.status} ${response.statusText}`,
          variant: "destructive"
        });
        
        return null;
      }
    } catch (error) {
      console.error("❌ Error updating user:", error);
      toast({
        title: "❌ Update Error",
        description: "An error occurred while updating the user",
        variant: "destructive"
      });
      return null;
    }
  };

  // Function to test API endpoints and see what's available
  const testAPIEndpoints = async () => {
    try {
      console.log("🔍 Testing API endpoints...");
      
      // Test 1: Get all users
      console.log("1. Testing GET /api/users");
      const allUsersResponse = await fetch(`${ADMIN_BASE_URL}/api/users`);
      console.log("All users response:", allUsersResponse.status, allUsersResponse.statusText);
      
      if (allUsersResponse.ok) {
        const allUsers = await allUsersResponse.json();
        console.log("All users data:", allUsers);
        
        // Test 2: Try to get profile for each user
        for (const user of allUsers) {
          console.log(`2. Testing GET /api/users/profile?email=${user.email}`);
          const profileResponse = await fetch(`${ADMIN_BASE_URL}/api/users/profile?email=${encodeURIComponent(user.email)}`);
          console.log(`Profile for ${user.email}:`, profileResponse.status, profileResponse.statusText);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log(`Profile data for ${user.email}:`, profileData);
          } else {
            const errorText = await profileResponse.text();
            console.log(`Error for ${user.email}:`, errorText);
          }
        }
      }
      
      toast({
        title: "🔍 API Test Complete",
        description: "Check console for detailed API endpoint test results",
      });
      
    } catch (error) {
      console.error("❌ Error testing API endpoints:", error);
      toast({
        title: "❌ API Test Failed",
        description: "An error occurred while testing API endpoints",
        variant: "destructive"
      });
    }
  };

  // Function to fetch and display user data from admin panel
  const fetchAndDisplayUserData = async (email?: string) => {
    try {
      const targetEmail = email || localStorage.getItem("spg_logged_in_email");
      if (!targetEmail) {
        toast({
          title: "❌ No Email Found",
          description: "Please provide an email or log in first",
          variant: "destructive"
        });
        return;
      }

      console.log("🔄 Fetching user data for:", targetEmail);
      
      // Fetch user profile data
      const response = await fetch(`${ADMIN_BASE_URL}/api/users/profile?email=${encodeURIComponent(targetEmail)}`);
      
      if (response.ok) {
        const userData = await response.json();
        console.log("✅ User data fetched successfully:", userData);
        
        // Display user data in a formatted way
        const displayData = {
          "👤 User Info": {
            "Email": userData.email || "N/A",
            "Username": userData.username || "N/A",
            "First Name": userData.firstName || "N/A",
            "Last Name": userData.lastName || "N/A",
            "Role": userData.role || "N/A",
            "Status": userData.status || "N/A",
            "Created At": userData.createdAt || "N/A",
            "Last Active": userData.lastActive || "N/A"
          },
          "📚 Board & Standards": {
            "Board ID": userData.boardId || userData.selectedBoard?.id || "N/A",
            "Board Name": userData.boardName || userData.selectedBoard?.name || "N/A",
            "Standard ID": userData.standardId || userData.selectedStandard?.id || "N/A",
            "Standard Name": userData.standardName || userData.selectedStandard?.name || "N/A",
            "Full Board Object": userData.selectedBoard || "N/A",
            "Full Standard Object": userData.selectedStandard || "N/A"
          },
          "📄 Additional Data": {
            "Created Papers": userData.createdPapers?.length || 0,
            "Total Papers": userData.createdPapers || "N/A"
          }
        };
        
        console.log("📊 Formatted User Data:", displayData);
        
        toast({
          title: "✅ User Data Fetched!",
          description: `Data for ${targetEmail} loaded. Check console for details.`,
        });
        
        return userData;
      } else {
        console.error("❌ Failed to fetch user data:", response.status, response.statusText);
        toast({
          title: "❌ Fetch Failed",
          description: `Failed to fetch data: ${response.status} ${response.statusText}`,
          variant: "destructive"
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching user data:", error);
      toast({
        title: "❌ Fetch Error",
        description: "An error occurred while fetching user data",
        variant: "destructive"
      });
      return null;
    }
  };

  // Function to fetch all users data from admin panel
  const fetchAllUsersData = async () => {
    try {
      console.log("🔄 Fetching all users data...");
      
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`);
      
      if (response.ok) {
        const usersData = await response.json();
        console.log("✅ All users data fetched successfully:", usersData);
        
        // Display summary
        const summary = {
          "📊 Users Summary": {
            "Total Users": usersData.length || 0,
            "Users with Board Data": usersData.filter((user: any) => user.boardId || user.selectedBoard).length,
            "Users with Standard Data": usersData.filter((user: any) => user.standardId || user.selectedStandard).length,
            "Users with Both Board & Standard": usersData.filter((user: any) => 
              (user.boardId || user.selectedBoard) && (user.standardId || user.selectedStandard)
            ).length
          }
        };
        
        console.log("📈 Users Summary:", summary);
        console.log("👥 All Users Data:", usersData);
        
        toast({
          title: "✅ All Users Data Fetched!",
          description: `Found ${usersData.length} users. Check console for details.`,
        });
        
        return usersData;
      } else {
        console.error("❌ Failed to fetch all users data:", response.status, response.statusText);
        toast({
          title: "❌ Fetch Failed",
          description: `Failed to fetch all users: ${response.status} ${response.statusText}`,
          variant: "destructive"
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching all users data:", error);
      toast({
        title: "❌ Fetch Error",
        description: "An error occurred while fetching all users data",
        variant: "destructive"
      });
      return null;
    }
  };

  // Function to update user profile data in admin panel
  const updateUserProfileInAdmin = async (email: string, profileData: any, boardData?: Board | null, standardData?: Standard | null, purchasedSubjects?: any[]) => {
    try {
      // First check if user exists
      console.log("🔍 Checking if user exists before updating profile...");
      const userExists = await checkUserExists(email);
      
      if (!userExists) {
        console.log("❌ User doesn't exist in API - skipping profile update");
        console.log("💡 User needs to be created first before profile can be updated");
        return null;
      }

      // Include board and standards data in the profile update using correct field names
      const completeProfileData = {
        ...profileData,
        selectedBoardId: boardData?.id || null,
        selectedStandardId: standardData?.id || null,
        // Keep the full objects for reference
        selectedBoard: boardData || null,
        selectedStandard: standardData || null,
        // Also include the names for convenience
        boardName: boardData?.name || null,
        standardName: standardData?.name || null,
        // Include purchased subjects if provided
        purchasedSubjects: purchasedSubjects || profileData.purchasedSubjects || []
      };
      
      console.log("🔄 Updating user profile in admin panel:", email, completeProfileData);
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, ...completeProfileData }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ User profile updated successfully:", result);
        return result;
      } else if (response.status === 404) {
        console.log("❌ User not found in API (404) - user may not exist yet");
        console.log("💡 Consider creating the user first before updating profile");
        return null;
      } else {
        console.error("❌ Failed to update user profile:", response.status, response.statusText);
        return null;
      }
    } catch (error) {
      console.error("❌ Error updating user profile:", error);
      return null;
    }
  };

  // Function to check if user exists in admin panel
  const checkUserExists = async (email: string) => {
    try {
      console.log("🔄 Checking if user exists:", email);
      
      // Always use the users list approach since it's more reliable
      const usersResponse = await fetch(`${ADMIN_BASE_URL}/api/users`);
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        console.log("📋 All users in admin panel:", users);
        
        const userExists = users.some((user: any) => user.email === email);
        console.log(`✅ User ${email} exists in admin panel:`, userExists);
        
        if (userExists) {
          const userData = users.find((user: any) => user.email === email);
          console.log("👤 Found user data:", userData);
          return { exists: true, userData };
        }
        
        return { exists: false };
      } else {
        console.error("❌ Failed to fetch users list:", usersResponse.status, usersResponse.statusText);
        return { exists: false };
      }
    } catch (error) {
      console.error("❌ Error checking user:", error);
      return { exists: false };
    }
  };

  // Function to fetch user profile data from admin panel
  const fetchUserProfileFromAdmin = async (email: string) => {
    try {
      console.log("🔄 Fetching user profile from admin panel:", email);
      const response = await fetch(`${ADMIN_BASE_URL}/api/users`);

      if (response.ok) {
        const allUsers = await response.json();
        console.log("✅ All users fetched successfully:", allUsers);
        
        // Find the specific user by email
        const user = allUsers.find((u: any) => u.email === email);
        if (user) {
          console.log("✅ User found:", user);
          return user;
      } else {
          console.log("❌ User not found in API:", email);
          return null;
        }
      } else {
        console.error("❌ Failed to fetch users:", response.status, response.statusText);
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching user profile:", error);
      return null;
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
        
        // Check if this is a new user
        const isNew = isNewUser(email);
        
        // Persist session for future auto-login
        try {
          localStorage.setItem("spg_logged_in_email", email);
        } catch {}
        
        // Update auth context
        setUserEmail(email);
        setIsLoggedIn(true);
        
        // Save login activity
        await saveUserActivity("login", { 
          isNewUser: isNew,
          loginTime: new Date().toISOString()
        });
        
        // If user already exists, fetch a fresh profile to decide navigation
        if (userExists === true) {
          const freshProfile = await fetchUserProfileFromAdmin(email);
          const apiBoardId = freshProfile?.selectedBoardId || freshProfile?.selectedBoard?.id;
          const apiStandardId = freshProfile?.selectedStandardId || freshProfile?.selectedStandard?.id;

          if (apiBoardId && apiStandardId) {
            const boardObj: any = freshProfile?.selectedBoard || { id: apiBoardId, name: freshProfile?.boardName || "Board" };
            const standardObj: any = freshProfile?.selectedStandard || { id: apiStandardId, name: freshProfile?.standardName || "Standard" };
            setSelectedBoard(boardObj);
            setSelectedStandard(standardObj);
            try { localStorage.setItem("spg_selected_board", JSON.stringify(boardObj)); } catch {}
            try { localStorage.setItem("spg_selected_standard", JSON.stringify(standardObj)); } catch {}
            setCurrentStep("subjects");
            await refreshUserPurchasedSubjects();
            setLoading(false);
            toast({ title: "Login Successful", description: "Welcome back! Loaded your board and standard from your profile." });
            return;
          }
        }

        // Otherwise, enforce board and standard selection
        try {
          localStorage.removeItem("spg_selected_board");
          localStorage.removeItem("spg_selected_standard");
        } catch {}
        setSelectedBoard(null);
        setSelectedStandard(null);
        setShowBoardsPopup(true);
        setIsModalOpen(true);
        setCurrentStep("boards");
        setLoading(false);
        toast({ title: "Login Successful", description: "Please select your Board and Standard to continue." });
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

  // Deprecated direct ChapterPaper redirect removed; we now use themed chapter-selection flow

  if (currentStep === "login") {
    console.log("Rendering login step");
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg animate-fade-in">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              Student Paper Generator
            </CardTitle>
            <CardDescription>
              Login to access your academic resources
            </CardDescription>
            {isOfflineMode && (
              <Alert className="mt-4">
                <AlertDescription className="text-sm">
                  📱 Running in offline mode - using sample data
                </AlertDescription>
              </Alert>
            )}
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

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password (min 6 characters)"
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
                  disabled={loading || isCheckingUser}
                  variant="academic"
                  className="w-full h-12"
                >
                  {loading || isCheckingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isCheckingUser ? "Checking account..." : "Sending OTP..."}
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
                    <br />
                    {/* Removed password hint for cleaner UI */}
                  </p>
                  
                  {/* Debug info removed for production */}
                  
                  {/* Show previous user data if exists */}
                  {userExists === true && userPreviousData && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <span className="text-sm font-medium text-green-800">Welcome back!</span>
                      </div>
                      <div className="text-xs text-green-700 space-y-1">
                        {userPreviousData.selectedBoard && (
                          <div>📚 Board: {userPreviousData.selectedBoard.name}</div>
                        )}
                        {userPreviousData.selectedStandard && (
                          <div>🎓 Standard: {userPreviousData.selectedStandard.name}</div>
                        )}
                        {userPreviousData.createdPapers && userPreviousData.createdPapers.length > 0 && (
                          <div>📄 Papers: {userPreviousData.createdPapers.length} created</div>
                        )}
                        <div className="text-green-600 font-medium">Your data will be restored after verification</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show new user message if not exists */}
                  {userExists === false && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">+</span>
                        </div>
                        <span className="text-sm font-medium text-blue-800">New User</span>
                      </div>
                      <div className="text-xs text-blue-700">
                        Welcome! We'll set up your account after verification.
                      </div>
                    </div>
                  )}
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
              onClick={() => {
                setIsModalOpen(false);
                setShowBoardsPopup(false);
                setCurrentStep('subjects');
              }}
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
                  onClick={() => {
                    setIsModalOpen(false);
                    setShowStandardsPopup(false);
                  }}
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

  if (currentStep === "standards") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
        <div className="w-full max-w-xl mx-auto">
          <div className="bg-white rounded-t-2xl shadow-2xl p-6 max-h-[80vh] animate-slide-up relative flex flex-col">
            <button
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 z-10"
              onClick={() => {
                setIsModalOpen(false);
                setShowStandardsPopup(false);
                setCurrentStep('subjects');
              }}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Select Standard - {selectedBoard?.name}</h1>
            </div>
            {standards[selectedBoard?.id || 0] ? (
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
                    {standards[selectedBoard?.id || 0]
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
    );
  }

  if (currentStep === "subjects") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 p-4">
        <div className="max-w-md mx-auto">

          {/* Dropdown Selectors */}
          <div className="mb-6">
            <div className="space-y-3">
              {/* Board Selector */}
              <div 
                onClick={() => {
                  setIsModalOpen(true);
                  setShowBoardsPopup(true);
                  setCurrentStep("boards");
                }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 cursor-pointer hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <GraduationCap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 font-medium">Board</div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{selectedBoard?.name || "Select Board"}</div>
                    </div>
                  </div>
                  <div className="w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-800 transition-colors duration-200">
                    <ChevronRight className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                </div>
              </div>
              
              {/* Standard Selector */}
              <div 
                onClick={() => {
                  if (!selectedBoard) {
                    setError("Please select a board first");
                    return;
                  }
                  setIsModalOpen(true);
                  setShowStandardsPopup(true);
                  setCurrentStep("standards");
                }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 cursor-pointer hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 shadow-sm hover:shadow-md group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 font-medium">Standard</div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{selectedStandard?.name || "Select Standard"}</div>
                    </div>
                  </div>
                  <div className="w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-800 transition-colors duration-200">
                    <ChevronRight className="w-3 h-3 text-gray-500 dark:text-gray-400" />
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
            ) : loadingSubjects ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm">Loading subjects...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 pb-4">
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
                        
                        // Check if subject is purchased - ALWAYS check API first, never localStorage
                        let isPurchased = false;
                        const currentEmail = localStorage.getItem("spg_logged_in_email");
                        
                        // ONLY use API data, never localStorage for purchased subjects
                        if (currentEmail && userPreviousData && userPreviousData.purchasedSubjects) {
                          isPurchased = isSubjectPurchased(subjectObj.id, userPreviousData.purchasedSubjects);
                          console.log(`📚 Subject ${subjectObj.name} (ID: ${subjectObj.id}) - API check: ${isPurchased}`);
                        } else {
                          // If no API data available, assume NOT purchased
                          isPurchased = false;
                          console.log(`📚 Subject ${subjectObj.name} (ID: ${subjectObj.id}) - No API data, assuming NOT purchased`);
                        }
                        
                        return (
                          <div
                            key={index}
                            onClick={() => handleSubjectSelection(subjectObj)}
                            className="cursor-pointer flex flex-col items-center gap-1 p-1 hover:opacity-80 transition-opacity duration-200"
                          >
                            <div className={`w-12 h-12 ${getSubjectColor(subjectObj.name)} rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200`}>
                              {getSubjectIcon(subjectObj.name)}
                            </div>
                            <div className="text-center">
                              <h3 className="text-xs font-medium text-gray-800 leading-tight">
                                {subjectObj.name}
                              </h3>
                              {isFree ? (
                                <span className="text-xs text-green-600 font-medium mt-1 block">Free</span>
                              ) : isPurchased ? (
                                <span className="text-xs text-green-600 font-medium mt-1 block">Unlocked</span>
                              ) : (
                                <span className="text-xs text-orange-600 font-medium mt-1 block">₹{subjectObj.price}</span>
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



  if (currentStep === "paper-options") {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-md mx-auto">
            <div className="mb-6">
              <Button
                onClick={() => setCurrentStep("subjects")}
                variant="ghost"
                className="text-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            <div>
              <div className="space-y-4">
                <div
                  onClick={() => {
                    setPaperMode("random");
                    setCurrentStep("chapter-selection");
                  }}
                  className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">Random Paper</h3>
                      <p className="text-sm text-gray-600">Generate a random question paper</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setPaperMode("difficulty");
                    setCurrentStep("chapter-selection");
                  }}
                  className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:bg-green-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">By Difficulty</h3>
                      <p className="text-sm text-gray-600">Generate paper by difficulty level</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div
                  onClick={async () => {
                    if (!selectedSubject?.id) {
                      toast({ title: "Select a Subject", description: "Please choose a subject first." });
                      return;
                    }
                    setPaperMode("chapter");
                    setSelectedChapterNames([]);
                    try { await fetchChapters(selectedSubject.id); } catch {}
                    setCurrentStep("chapter-selection");
                  }}
                  className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">By Chapter</h3>
                      <p className="text-sm text-gray-600">Generate paper by chapter</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div
                  onClick={() => {
                    setPaperMode("custom");
                    setCurrentStep("custom-builder");
                  }}
                  className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">Custom Paper</h3>
                      <p className="text-sm text-gray-600">Create custom question paper</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Study Material Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Material</h3>
                <div className="space-y-4">
                  <div
                    onClick={() => {
                      // Add study material functionality here
                      console.log("Study Notes clicked");
                    }}
                    className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900">Study Notes</h3>
                        <p className="text-sm text-gray-600">Access comprehensive study notes</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      // Add practice tests functionality here
                      console.log("Practice Tests clicked");
                    }}
                    className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:border-teal-300 hover:bg-teal-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900">Practice Tests</h3>
                        <p className="text-sm text-gray-600">Take practice tests and quizzes</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
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
            </div>
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
      <div className="min-h-screen bg-gradient-to-b from-academic-background via-white to-white p-4">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-card animate-fade-in border border-academic-border/40">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Select Chapters
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                {selectedBoard?.name} • {selectedStandard?.name} • {selectedSubject?.name}
              </CardDescription>
              <Button
                onClick={() => setCurrentStep("paper-options")}
                variant="ghost"
                className="mt-2 text-academic-blue"
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
                      <Card key={chapter.id} className="p-4 hover:shadow-md transition-shadow border-academic-border/30">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`chapter-${chapter.id}`}
                            checked={selectedChapters.includes(chapter.id)}
                            onCheckedChange={() => toggleChapter(chapter.id)}
                          />
                          <Label htmlFor={`chapter-${chapter.id}`} className="cursor-pointer font-medium text-academic-ink">
                            {chapter.name}
                            <div className="text-xs text-muted-foreground">Click to select</div>
                          </Label>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t pt-4">
                    <div className="text-sm text-muted-foreground">
                      {selectedChapters.length} chapter{selectedChapters.length === 1 ? '' : 's'} selected
                    </div>
                    <Button
                      onClick={generateFromSelectedChapters}
                      disabled={selectedChapters.length === 0 || multiChapterLoading}
                      className="bg-academic-blue hover:bg-academic-blue/90 text-white"
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
                <div className="space-y-3 w-full">
                  {chapters
                    .filter((chapter) => chapter.name.toLowerCase().includes(chapterQuery.trim().toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((chapter, index) => {
                      const isExpanded = expandedChapters[chapter.name] || false;
                      const types = chapterQuestionTypes[chapter.name] || [];
                      const isLoadingTypes = loadingTypes[chapter.name] || false;

                      return (
                        <Card
                          key={chapter.id || index}
                          className="border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 w-full"
                        >
                          <CardContent className="p-4">
                            {paperMode === 'chapter' ? (
                              <div className="flex items-center gap-4 w-full">
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
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-semibold text-left break-words whitespace-normal leading-normal">
                                    {chapter.name}
                                  </h3>
                                  <div className="mt-1">
                                    <Badge variant="secondary" className="text-xs">Chapter</Badge>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="flex items-center gap-4 w-full cursor-pointer hover:bg-accent/50 rounded-md p-2 -m-2 transition-colors"
                                onClick={() => handleChapterClick(chapter.name)}
                              >
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                  <BookOpen className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-semibold text-left break-words whitespace-normal leading-normal">
                                    {chapter.name}
                                  </h3>
                                  <div className="mt-1">
                                    <Badge variant="secondary" className="text-xs">Chapter</Badge>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Question Types Dropdown */}
                            {paperMode !== 'chapter' && isExpanded && (
                              <div className="mt-4 border-t pt-4">
                                {isLoadingTypes ? (
                                  <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                                    <p className="text-sm text-muted-foreground mt-2">Loading question types...</p>
                                  </div>
                                ) : types.length > 0 ? (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Available Question Types:</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {types.map((type, typeIndex) => (
                                        <Button
                                          key={typeIndex}
                                          onClick={() => {
                                            setSelectedChapter(chapter.name);
                                            setSelectedQuestionType(type);
                                            setCurrentStep("question-selection");
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className="justify-start h-auto p-3 hover:bg-primary/5"
                                        >
                                          <div className="text-left">
                                            <div className="font-medium">{type}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {chapterQuestions.filter(q => q.type === type).length} questions
                                            </div>
                                          </div>
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground">No question types available</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
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
                          // Build types map and go to allocation screen
                          const byType: Record<string, number> = {};
                          pool.forEach(q => {
                            const raw = (q.type || '').toString().trim();
                            if (!raw) return; // skip questions without a type
                            const t = raw.charAt(0).toUpperCase() + raw.slice(1); // pretty label (e.g., "text" -> "Text")
                            byType[t] = (byType[t] || 0) + 1;
                          });
                          setSelectedChapter(selectedChapterNames.join(', '));
                          setSelectedQuestions(pool); // pool retained; we will sample from it
                          setTypeAllocations(Object.fromEntries(Object.keys(byType).map(t => [t, 0])));
                          setCurrentStep('type-allocation');
                        } catch (e) {
                          console.error(e);
                          setError('Failed to generate PDF from selected chapters.');
                        }
                      }}
                      className="bg-academic-blue hover:bg-academic-blue/90"
                    >
                      Next
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

  // New: Type allocation step for mixed paper from selected chapters
  if (currentStep === 'type-allocation') {
    const byTypeMap: Record<string, { count: number; marks: number } > = {};
    (selectedQuestions as any[]).forEach((q: any) => {
      const raw = (q.type || '').toString().trim();
      if (!raw) return; // only show types that exist on questions
      const t = raw.charAt(0).toUpperCase() + raw.slice(1);
      const m = Number(q.marks || 0);
      if (!byTypeMap[t]) byTypeMap[t] = { count: 0, marks: 0 };
      byTypeMap[t].count += 1;
      byTypeMap[t].marks = m || byTypeMap[t].marks;
    });
    const types = Object.keys(byTypeMap);
    const totalMarks = types.reduce((sum, t) => sum + (typeAllocations[t] || 0) * (byTypeMap[t].marks || 0), 0);
    const totalSelected = types.reduce((sum, t) => sum + (typeAllocations[t] || 0), 0);

    return (
      <div className="min-h-screen bg-gradient-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-card animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Chapter Paper</CardTitle>
              <CardDescription className="flex justify-between">
                <span>{selectedStandard?.name} - {selectedSubject?.name}</span>
                <span>Total Exam Mark : {totalMarks}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {types.map((t) => (
                  <Card key={t} className="border bg-card hover:border-primary/50 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-base font-semibold leading-tight">{t}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{byTypeMap[t].marks ? `${byTypeMap[t].marks} Marks` : ''}</div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{byTypeMap[t].count} Questions</div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Ask Question</div>
                          <Input
                            type="number"
                            min={0}
                            max={byTypeMap[t].count}
                            value={typeAllocations[t] ?? 0}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(byTypeMap[t].count, Number(e.target.value || 0)));
                              setTypeAllocations(prev => ({ ...prev, [t]: v }));
                            }}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Out of Question</div>
                          <Input value={String(byTypeMap[t].count)} readOnly className="w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
            <CardFooter className="sticky bottom-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
              <div className="w-full flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Selected: {totalSelected} • Total Marks: {totalMarks}</div>
                <Button
                  className="min-w-32 bg-academic-blue hover:bg-academic-blue/90"
                  onClick={() => {
                    // Sample from selectedQuestions according to typeAllocations
                    const pool = selectedQuestions as any[];
                    const result: any[] = [];
                    const byType: Record<string, any[]> = {};
                    pool.forEach(q => {
                      const raw = (q.type || '').toString().trim();
                      if (!raw) return;
                      const t = raw.charAt(0).toUpperCase() + raw.slice(1);
                      if (!byType[t]) byType[t] = [];
                      byType[t].push(q);
                    });
                    Object.keys(typeAllocations).forEach(t => {
                      const need = Math.min(typeAllocations[t] || 0, (byType[t] || []).length);
                      const shuffled = (byType[t] || []).slice().sort(() => Math.random() - 0.5);
                      result.push(...shuffled.slice(0, need));
                    });
                    if (result.length === 0) {
                      setError('Please enter at least one question.');
                      return;
                    }
                    setSelectedQuestions(result);
                    setSelectedQuestionType('Mixed');
                    setCurrentStep('paper-review');
                  }}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
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
                onClick={() => setCurrentStep("chapter-selection")}
                variant="ghost"
                className="mt-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Change Chapter
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
                            <LatexPreview content={question.question || question.text || question.content || '[No question text]'} />
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
                                              <div className="mt-2 p-2 border rounded bg-muted/30">
                                                <Label className="text-[10px] sm:text-xs text-muted-foreground">Preview</Label>
                                                <div className="text-xs sm:text-sm">
                                                  <LatexPreview content={q.text || ''} />
                                                </div>
                                              </div>
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
                                        <div className="mt-2 p-2 border rounded bg-muted/30">
                                          <Label className="text-[10px] sm:text-xs text-muted-foreground">Preview</Label>
                                          <div className="text-xs sm:text-sm">
                                            <LatexPreview content={question.question || (question as any).text || (question as any).content || ''} />
                                          </div>
                                        </div>
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
                        <h3 className="text-lg font-semibold flex gap-2">
                          <span>Q{index + 1}.</span>
                          <LatexPreview content={getQuestionText(question) || '[No question text]'} />
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