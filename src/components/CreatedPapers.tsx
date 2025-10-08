import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { 
  FileText, 
  Download, 
  Trash2, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Clock,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  X
} from "lucide-react";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import PaperPreviewModal from "./PaperPreviewModal";

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
  pdfBlob?: Blob;
  pdfUrl?: string;
}

interface CreatedPapersProps {
  onBack: () => void;
}

export default function CreatedPapers({ onBack }: CreatedPapersProps) {
  const { isDarkMode } = useDarkMode();
  const [papers, setPapers] = useState<CreatedPaper[]>([]);
  const [filteredPapers, setFilteredPapers] = useState<CreatedPaper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [loading, setLoading] = useState(true);
  const [previewPaper, setPreviewPaper] = useState<CreatedPaper | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load papers from localStorage on component mount
  useEffect(() => {
    loadPapers();
  }, []);

  // Filter papers based on search and filters
  useEffect(() => {
    let filtered = papers;

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(paper =>
        paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.board.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(paper => paper.type === filterType);
    }

    // Subject filter
    if (filterSubject !== "all") {
      filtered = filtered.filter(paper => paper.subject === filterSubject);
    }

    setFilteredPapers(filtered);
  }, [papers, searchQuery, filterType, filterSubject]);

  const loadPapers = () => {
    try {
      const savedPapers = localStorage.getItem('createdPapers');
      if (savedPapers) {
        const parsedPapers = JSON.parse(savedPapers);
        setPapers(parsedPapers);
      }
    } catch (error) {
      console.error('Error loading papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePaper = (paperId: string) => {
    const updatedPapers = papers.filter(paper => paper.id !== paperId);
    setPapers(updatedPapers);
    localStorage.setItem('createdPapers', JSON.stringify(updatedPapers));
  };

  const downloadPaper = (paper: CreatedPaper) => {
    if (paper.pdfUrl) {
      const link = document.createElement('a');
      link.href = paper.pdfUrl;
      link.download = `${paper.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (paper.pdfBlob) {
      const url = URL.createObjectURL(paper.pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${paper.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreviewPaper = (paper: CreatedPaper) => {
    setPreviewPaper(paper);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewPaper(null);
  };

  const printPaper = (paper: CreatedPaper) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Generate sample questions if not available
      const generateSampleQuestions = (count: number, type: string, difficulty?: string) => {
        return Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          question: `Sample ${type} Question ${i + 1}`,
          text: `Sample ${type} Question ${i + 1}`,
          content: `Sample ${type} Question ${i + 1}`,
          type: type,
          difficulty: difficulty || 'medium',
          marks: Math.floor(paper.totalMarks / count),
          chapter: paper.chapters?.[0] || 'General'
        }));
      };

      // Use actual questions if available, otherwise generate sample questions
      let questionsToPrint = paper.questions || [];
      
      if (questionsToPrint.length === 0) {
        // Generate sample questions based on paper type and total questions
        if (paper.type === 'Mixed') {
          const mcqCount = Math.ceil(paper.totalQuestions * 0.6);
          const shortAnswerCount = paper.totalQuestions - mcqCount;
          questionsToPrint = [
            ...generateSampleQuestions(mcqCount, 'MCQ', paper.difficulty),
            ...generateSampleQuestions(shortAnswerCount, 'Short Answer', paper.difficulty)
          ];
        } else {
          questionsToPrint = generateSampleQuestions(paper.totalQuestions, paper.type, paper.difficulty);
        }
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${paper.title}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                line-height: 1.6;
                color: #333;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              .header h1 {
                margin: 0 0 10px 0;
                font-size: 24px;
              }
              .info { 
                margin-bottom: 30px; 
                background: #f5f5f5;
                padding: 15px;
                border-radius: 5px;
              }
              .question { 
                margin-bottom: 25px; 
                page-break-inside: avoid; 
                border-left: 3px solid #007bff;
                padding-left: 15px;
              }
              .question-number { 
                font-weight: bold; 
                font-size: 16px;
                margin-bottom: 8px;
              }
              .question-meta {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
              }
              .question-text {
                margin: 10px 0;
                font-size: 14px;
              }
              @media print {
                body { margin: 0; }
                .question { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${paper.title}</h1>
              <p><strong>${paper.board} - ${paper.standard} - ${paper.subject}</strong></p>
              <p>Total Questions: ${paper.totalQuestions} | Total Marks: ${paper.totalMarks}</p>
            </div>
            
            <div class="info">
              <p><strong>Paper Type:</strong> ${paper.type}</p>
              ${paper.difficulty ? `<p><strong>Difficulty Level:</strong> ${paper.difficulty}</p>` : ''}
              ${paper.chapters && paper.chapters.length > 0 ? `<p><strong>Chapters:</strong> ${paper.chapters.join(', ')}</p>` : ''}
              <p><strong>Created:</strong> ${new Date(paper.createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            
            <div class="questions-section">
              <h2>Questions</h2>
              ${questionsToPrint.map((q, i) => `
                <div class="question">
                  <div class="question-number">Q${i + 1}.</div>
                  <div class="question-text">${q.question || q.text || q.content || `Sample question ${i + 1}`}</div>
                  <div class="question-meta">
                    <strong>Type:</strong> ${q.type} | 
                    <strong>Difficulty:</strong> ${q.difficulty} | 
                    <strong>Marks:</strong> ${q.marks || Math.floor(paper.totalMarks / paper.totalQuestions)}
                    ${q.chapter ? ` | <strong>Chapter:</strong> ${q.chapter}` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
              <p>--- End of Paper ---</p>
              <p>Generated by Study Path Genie</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getUniqueSubjects = () => {
    return Array.from(new Set(papers.map(paper => paper.subject)));
  };

  const getUniqueTypes = () => {
    return Array.from(new Set(papers.map(paper => paper.type)));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your papers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-1 sm:p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Created Papers</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {papers.length} paper{papers.length !== 1 ? 's' : ''} created
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Simple Clean Filters */}
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {getUniqueTypes().map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {getUniqueSubjects().map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterType !== "all" || filterSubject !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType("all");
                  setFilterSubject("all");
                }}
                className="h-7 px-2 text-xs text-gray-500"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Papers List */}
        {filteredPapers.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {papers.length === 0 ? 'No papers created yet' : 'No papers match your filters'}
            </h3>
            <p className="text-gray-500 mb-6">
              {papers.length === 0 
                ? 'Create your first question paper to get started!' 
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {papers.length === 0 && (
              <Button onClick={onBack} className="bg-blue-600 hover:bg-blue-700">
                Create Paper
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filteredPapers.map((paper) => (
              <Card key={paper.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-3 sm:p-6">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{paper.title}</h3>
                      <div className="flex flex-wrap gap-1 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {paper.type}
                        </Badge>
                        {paper.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {paper.difficulty}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span>{paper.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        <span>{paper.board}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{paper.totalQuestions} questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{paper.totalMarks} marks</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>Created on {formatDate(paper.createdAt)}</span>
                    </div>

                    {paper.chapters && paper.chapters.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Chapters:</p>
                        <div className="flex flex-wrap gap-1">
                          {paper.chapters.map((chapter, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {chapter}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreviewPaper(paper)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => downloadPaper(paper)}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePaper(paper.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:block">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{paper.title}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {paper.type}
                          </Badge>
                          {paper.difficulty && (
                            <Badge variant="outline" className="text-xs">
                              {paper.difficulty}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{paper.subject}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4" />
                            <span>{paper.board}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>{paper.totalQuestions} questions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{paper.totalMarks} marks</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                          <Calendar className="w-4 h-4" />
                          <span>Created on {formatDate(paper.createdAt)}</span>
                        </div>

                        {paper.chapters && paper.chapters.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Chapters:</p>
                            <div className="flex flex-wrap gap-1">
                              {paper.chapters.map((chapter, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {chapter}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewPaper(paper)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => downloadPaper(paper)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deletePaper(paper.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <PaperPreviewModal
        paper={previewPaper}
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onDownload={downloadPaper}
        onPrint={printPaper}
      />
    </div>
  );
}
