import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Label, Checkbox } from "@/components/ui";
import LatexPreview from "./LatexPreview";

const questionCounts = [10, 20, 30, 50];
const paperTypes = ["MCQ", "Short Answer", "Mixed"];

export default function ChapterPaper({ subject, standard, board, chapters = [], onBack }) {
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [customQuestions, setCustomQuestions] = useState("");
  const [paperType, setPaperType] = useState("Mixed");
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState("selectChapter"); // "selectChapter", "preview"

  const handleChapterSelect = (chapterId) => {
    setSelectedChapter(chapterId);
    // Generate questions immediately and go to preview
    handleGenerate(chapterId);
  };

  const handleGenerate = async (chapterId = selectedChapter) => {
    // TODO: Replace with actual API call
    const totalQuestions = customQuestions ? Number(customQuestions) : numQuestions;
    let typeList = [];
    if (paperType === "Mixed") {
      typeList = ["MCQ", "Short Answer"];
    } else {
      typeList = [paperType];
    }
    const questions = Array.from({ length: totalQuestions }, (_, i) => ({
      id: i + 1,
      text: `Question ${i + 1} from Chapter ${chapterId}`,
      type: typeList[i % typeList.length],
      chapterId: chapterId,
    }));
    setGeneratedQuestions(questions);
    setCurrentStep("preview");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-card animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white mb-2 flex items-center justify-center">
              <span className="mr-2">🎓</span> By Chapter
            </CardTitle>
            <div className="text-white mb-2">
              {board} - {standard} - {subject}
            </div>
            <Button variant="ghost" className="mt-2" onClick={onBack}>
              ← Back
            </Button>
          </CardHeader>
          
          {/* Step 1: Chapter Selection */}
          {currentStep === "selectChapter" && (
            <CardContent>
              <div className="mb-6">
                <Label className="text-white mb-4 block text-lg font-semibold">Select a Chapter</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chapters.map((chapter) => (
                    <Button
                      key={chapter.id}
                      className="bg-white text-purple-700 rounded-lg py-4 text-left justify-start hover:bg-purple-50 transition-colors"
                      onClick={() => handleChapterSelect(chapter.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📚</span>
                        <div>
                          <div className="font-semibold">{chapter.name}</div>
                          <div className="text-sm text-purple-600">Click to select</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          )}

          {/* Step 2: Paper Edit & Preview */}
          {currentStep === "preview" && (
            <CardContent>
              <div className="mb-4 text-white text-xl font-semibold">
                Paper for: {chapters.find(c => c.id === selectedChapter)?.name}
              </div>
              
              {/* Edit Options */}
              <div className="mb-6 bg-purple-600 rounded-lg p-4">
                <div className="mb-4">
                  <Label className="text-white mb-2 block">Number of Questions</Label>
                  <div className="flex gap-4 mb-2">
                    {questionCounts.map((count) => (
                      <Button
                        key={count}
                        className={`rounded-full px-6 py-2 ${numQuestions === count && !customQuestions ? "bg-white text-purple-700" : "bg-purple-500 text-white"}`}
                        onClick={() => { setNumQuestions(count); setCustomQuestions(""); }}
                      >
                        {count}
                      </Button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      placeholder="Custom"
                      value={customQuestions}
                      onChange={e => setCustomQuestions(e.target.value)}
                      className="rounded px-2 w-20 ml-2"
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <Label className="text-white mb-2 block">Paper Type</Label>
                  <div className="flex gap-4">
                    {paperTypes.map((type) => (
                      <Button
                        key={type}
                        className={`rounded-full px-6 py-2 ${paperType === type ? "bg-white text-purple-700" : "bg-purple-500 text-white"}`}
                        onClick={() => setPaperType(type)}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <Button 
                  className="bg-white text-purple-700 rounded-lg px-6 py-2" 
                  onClick={() => handleGenerate()}
                >
                  Regenerate Paper
                </Button>
              </div>
              
              {/* Questions Preview */}
              <div className="bg-white rounded-lg p-6 mb-4 shadow-md">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="mb-4 pb-2 border-b">
                    <div className="font-bold text-lg flex gap-2">
                      <span>Q{i + 1}.</span>
                      <LatexPreview content={q.text} />
                    </div>
                    <div className="text-sm text-gray-500">Type: {q.type}</div>
                  </div>
                ))}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button className="bg-purple-600 text-white rounded-lg px-6 py-2">Download PDF</Button>
                <Button className="bg-purple-600 text-white rounded-lg px-6 py-2">Print Paper</Button>
                <Button className="bg-purple-600 text-white rounded-lg px-6 py-2">Save for Later</Button>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button 
                  variant="ghost" 
                  className="text-white" 
                  onClick={() => setCurrentStep("selectChapter")}
                >
                  ← Back to Chapters
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
