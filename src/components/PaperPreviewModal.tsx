import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Printer, 
  X, 
  BookOpen, 
  GraduationCap, 
  FileText, 
  Clock,
  Calendar,
  User
} from "lucide-react";
import LatexPreview from "./LatexPreview";

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

interface CreatedPaper {
  id: string;
  title: string;
  subject: string;
  board: string;
  standard: string;
  type: string;
  difficulty?: string;
  chapters?: string[];
  totalQuestions: number;
  totalMarks: number;
  createdAt: string;
  questions?: Question[];
  pdfBlob?: Blob;
  pdfUrl?: string;
}

interface PaperPreviewModalProps {
  paper: CreatedPaper | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (paper: CreatedPaper) => void;
  onPrint: (paper: CreatedPaper) => void;
}

const PaperPreviewModal: React.FC<PaperPreviewModalProps> = ({
  paper,
  isOpen,
  onClose,
  onDownload,
  onPrint
}) => {
  if (!paper) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    onPrint(paper);
    onClose();
  };

  const handleDownload = () => {
    onDownload(paper);
    onClose();
  };

  // Build questions for preview: use actual questions if provided,
  // otherwise generate sample questions based on paper config (mirrors print behavior)
  const generateSampleQuestions = (count: number, type: string, difficulty?: string) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      question: `[Sample ${type} Question ${i + 1} - Real questions will appear here when using actual API data]`,
      text: `[Sample ${type} Question ${i + 1} - Real questions will appear here when using actual API data]`,
      content: `[Sample ${type} Question ${i + 1} - Real questions will appear here when using actual API data]`,
      type: type,
      difficulty: difficulty || "medium",
      marks: Math.floor(paper.totalMarks / Math.max(count, 1)),
      chapter: paper.chapters?.[0] || "General",
    }));
  };

  const questionsToPreview = React.useMemo(() => {
    let questions = paper.questions || [];
    if (questions.length > 0) return questions;
    if (paper.type === "Mixed") {
      const mcqCount = Math.ceil(paper.totalQuestions * 0.6);
      const shortAnswerCount = Math.max(paper.totalQuestions - mcqCount, 0);
      return [
        ...generateSampleQuestions(mcqCount, "MCQ", paper.difficulty),
        ...generateSampleQuestions(shortAnswerCount, "Short Answer", paper.difficulty),
      ];
    }
    return generateSampleQuestions(paper.totalQuestions, paper.type, paper.difficulty);
  }, [paper]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 w-[95vw] sm:w-full">
        <DialogHeader className="p-4 sm:p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pr-2">
              {paper.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col h-full">
          <ScrollArea className="flex-1 p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
              {/* Full Paper Layout Preview */}
              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{paper.title}</h1>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{paper.board}</span>
                  {" "}-{" "}
                  <span className="font-semibold">{paper.standard}</span>
                  {" "}-{" "}
                  <span className="font-semibold">{paper.subject}</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Total Questions: {paper.totalQuestions} | Total Marks: {paper.totalMarks}
                </p>
              </div>

              <div className="mb-6 sm:mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-md border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Paper Type:</span> {paper.type}
                  </div>
                  {paper.difficulty && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">Difficulty Level:</span> {paper.difficulty}
                    </div>
                  )}
                  {paper.chapters && paper.chapters.length > 0 && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
                      <span className="font-semibold">Chapters:</span> {paper.chapters.join(', ')}
                    </div>
                  )}
                  <div className="text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
                    <span className="font-semibold">Created:</span> {formatDate(paper.createdAt)}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">Questions</h2>
                {questionsToPreview && questionsToPreview.length > 0 ? (
                  <div className="space-y-4">
                    {questionsToPreview.map((question, index) => (
                      <div key={question.id} className="border-l-4 border-blue-600 pl-3 sm:pl-4">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2">
                          <span className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">Q{index + 1}.</span>
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <Badge variant="outline" className="text-xs">{question.type}</Badge>
                            <Badge variant="outline" className="text-xs">{question.difficulty}</Badge>
                            <Badge variant="outline" className="text-xs">{question.marks || Math.floor(paper.totalMarks / paper.totalQuestions)} marks</Badge>
                          </div>
                        </div>
                        <div className="mb-2">
                          <LatexPreview content={question.question || question.text || question.content || ''} />
                        </div>
                        {question.chapter && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">Chapter: {question.chapter}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>No questions available for preview</p>
                    <p className="text-sm">Try creating a paper with specific chapters or difficulty.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
                <p>--- End of Paper ---</p>
                <p>Generated by Study Path Genie</p>
              </div>
            </div>
          </ScrollArea>

          {/* Action Buttons */}
          <div className="p-4 sm:p-6 pt-4 border-t bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaperPreviewModal;
