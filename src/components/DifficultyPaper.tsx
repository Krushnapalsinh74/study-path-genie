import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription, Button, Label, Input } from "@/components/ui";
import LatexPreview from "./LatexPreview";

const difficultyLevels = [
  { label: "Easy", value: "easy", color: "bg-green-400" },
  { label: "Medium", value: "medium", color: "bg-orange-400" },
  { label: "Hard", value: "hard", color: "bg-red-400" },
];

export default function DifficultyPaper({ subject, standard, board, onBack }) {
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [numQuestions, setNumQuestions] = useState(10);
  const [customRatio, setCustomRatio] = useState({ easy: 50, medium: 30, hard: 20 });
  const [useCustomRatio, setUseCustomRatio] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState("config"); // "config", "type-allocation", "preview"
  const [typeAllocations, setTypeAllocations] = useState({});

  const handleGenerate = async () => {
    // TODO: Replace with actual API call
    let questions = [];
    if (useCustomRatio) {
      const total = numQuestions;
      const easyCount = Math.round((customRatio.easy / 100) * total);
      const mediumCount = Math.round((customRatio.medium / 100) * total);
      const hardCount = total - easyCount - mediumCount;
      questions = [
        ...Array.from({ length: easyCount }, (_, i) => ({ 
          id: `e${i+1}`, 
          text: `Easy Question ${i+1}`, 
          type: "MCQ", 
          difficulty: "easy",
          marks: 1 
        })),
        ...Array.from({ length: mediumCount }, (_, i) => ({ 
          id: `m${i+1}`, 
          text: `Medium Question ${i+1}`, 
          type: "Short Answer", 
          difficulty: "medium",
          marks: 2 
        })),
        ...Array.from({ length: hardCount }, (_, i) => ({ 
          id: `h${i+1}`, 
          text: `Hard Question ${i+1}`, 
          type: "Text", 
          difficulty: "hard",
          marks: 3 
        })),
      ];
    } else {
      questions = Array.from({ length: numQuestions }, (_, i) => ({
        id: i + 1,
        text: `${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)} Question ${i + 1}`,
        type: selectedDifficulty === "easy" ? "MCQ" : selectedDifficulty === "medium" ? "Short Answer" : "Text",
        difficulty: selectedDifficulty,
        marks: selectedDifficulty === "easy" ? 1 : selectedDifficulty === "medium" ? 2 : 3,
      }));
    }
    setGeneratedQuestions(questions);
    
    // If mixed difficulty (custom ratio), go to type-allocation, otherwise go directly to preview
    if (useCustomRatio) {
      setCurrentStep("type-allocation");
    } else {
      setCurrentStep("preview");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-700 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-card animate-fade-in">
          {/* Header - shown for config and preview, hidden for type-allocation */}
          {currentStep !== "type-allocation" && (
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-white mb-2 flex items-center justify-center">
                <span className="mr-2">👥</span> By Difficulty
              </CardTitle>
              <div className="text-white mb-2">
                {board} - {standard} - {subject}
              </div>
              <Button variant="ghost" className="mt-2" onClick={onBack}>
                ← Back
              </Button>
            </CardHeader>
          )}
          
          {/* Step 1: Configuration */}
          {currentStep === "config" && (
            <CardContent>
              <div className="mb-6">
                <Label className="text-white mb-2 block">Select Difficulty</Label>
                <div className="flex gap-4 mb-4">
                  {difficultyLevels.map((level) => (
                    <Button
                      key={level.value}
                      className={`rounded-full px-6 py-2 ${selectedDifficulty === level.value ? "bg-white text-green-700" : `${level.color} text-white`}`}
                      onClick={() => { setSelectedDifficulty(level.value); setUseCustomRatio(false); }}
                    >
                      {level.label}
                    </Button>
                  ))}
                  <Button
                    className={`rounded-full px-6 py-2 bg-gray-200 text-green-700`}
                    onClick={() => setUseCustomRatio(true)}
                  >
                    Mixed Difficulty
                  </Button>
                </div>
                {useCustomRatio && (
                  <div className="mb-4">
                    <Label className="text-white mb-2 block">Custom Ratio (%)</Label>
                    <div className="flex gap-2">
                      <input type="number" min={0} max={100} value={customRatio.easy} onChange={e => setCustomRatio({ ...customRatio, easy: Number(e.target.value) })} className="w-16 rounded px-2" />
                      <span className="text-white">Easy</span>
                      <input type="number" min={0} max={100} value={customRatio.medium} onChange={e => setCustomRatio({ ...customRatio, medium: Number(e.target.value) })} className="w-16 rounded px-2" />
                      <span className="text-white">Medium</span>
                      <input type="number" min={0} max={100} value={customRatio.hard} onChange={e => setCustomRatio({ ...customRatio, hard: Number(e.target.value) })} className="w-16 rounded px-2" />
                      <span className="text-white">Hard</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mb-6">
                <Label className="text-white mb-2 block">Select Number of Questions</Label>
                <div className="flex gap-4">
                  {[10, 20, 30, 50].map((count) => (
                    <Button
                      key={count}
                      className={`rounded-full px-6 py-2 ${numQuestions === count ? "bg-white text-green-700" : "bg-green-600 text-white"}`}
                      onClick={() => setNumQuestions(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-white text-green-700 rounded-lg py-3 text-lg font-bold" onClick={handleGenerate}>
                Generate Paper
              </Button>
            </CardContent>
          )}

          {/* Step 2: Type Allocation (only for Mixed Difficulty) */}
          {currentStep === "type-allocation" && (() => {
            const byTypeMap = {};
            generatedQuestions.forEach((q) => {
              const t = q.type || "Unknown";
              const m = Number(q.marks || 0);
              if (!byTypeMap[t]) byTypeMap[t] = { count: 0, marks: 0 };
              byTypeMap[t].count += 1;
              byTypeMap[t].marks = m || byTypeMap[t].marks;
            });
            const types = Object.keys(byTypeMap);
            const totalMarks = types.reduce((sum, t) => sum + (typeAllocations[t] || 0) * (byTypeMap[t].marks || 0), 0);
            const totalSelected = types.reduce((sum, t) => sum + (typeAllocations[t] || 0), 0);

            return (
              <>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Select Question Types</CardTitle>
                  <CardDescription className="text-white/80">
                    Total Exam Mark: {totalMarks}
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
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {byTypeMap[t].marks ? `${byTypeMap[t].marks} Marks` : ''}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {byTypeMap[t].count} Questions
                            </div>
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
                <CardFooter className="sticky bottom-0 bg-background/80 backdrop-blur border-t">
                  <div className="w-full flex items-center justify-between gap-3">
                    <div className="text-sm text-white">
                      Selected: {totalSelected} • Total Marks: {totalMarks}
                    </div>
                    <Button
                      className="min-w-32 bg-white text-green-700 hover:bg-white/90"
                      onClick={() => {
                        // Filter questions based on type allocations
                        const byType = {};
                        generatedQuestions.forEach(q => {
                          const t = q.type || "Unknown";
                          if (!byType[t]) byType[t] = [];
                          byType[t].push(q);
                        });
                        const result = [];
                        Object.keys(typeAllocations).forEach(t => {
                          const need = Math.min(typeAllocations[t] || 0, (byType[t] || []).length);
                          const shuffled = (byType[t] || []).slice().sort(() => Math.random() - 0.5);
                          result.push(...shuffled.slice(0, need));
                        });
                        if (result.length === 0) {
                          alert('Please select at least one question.');
                          return;
                        }
                        setGeneratedQuestions(result);
                        setCurrentStep("preview");
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </CardFooter>
              </>
            );
          })()}

          {/* Step 3: Preview */}
          {currentStep === "preview" && (
            <CardContent>
              <div className="mb-4 text-white text-xl font-semibold">Preview</div>
              <div className="bg-white rounded-lg p-4 mb-4">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="mb-3">
                    <div className="font-bold flex gap-2">
                      <span>Q{i + 1}.</span>
                      <LatexPreview content={q.text} />
                    </div>
                    <div className="text-sm text-gray-500">
                      Type: {q.type} • Difficulty: {q.difficulty} • Marks: {q.marks || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Download PDF</Button>
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Print Paper</Button>
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Save for Later</Button>
              </div>
              <Button variant="ghost" className="mt-6 text-white" onClick={() => setCurrentStep("config")}>
                ← Back to Options
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
