import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription, Button, Label, Checkbox, Input } from "@/components/ui";
import LatexPreview from "./LatexPreview";

const questionCounts = [10, 20, 30, 50];
const paperTypes = ["MCQ", "Short Answer", "Mixed"];

export default function RandomPaper({ subject, standard, board, onBack }) {
  const [numQuestions, setNumQuestions] = useState(10);
  const [customQuestions, setCustomQuestions] = useState("");
  const [paperType, setPaperType] = useState("Mixed");
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState("config"); // "config", "type-allocation", "preview"
  const [typeAllocations, setTypeAllocations] = useState({});

  const handleGenerate = async () => {
    // TODO: Replace with actual API call
    const totalQuestions = customQuestions ? Number(customQuestions) : numQuestions;
    let typeList = [];
    if (paperType === "Mixed") {
      typeList = ["MCQ", "Short Answer", "Text"];
    } else {
      typeList = [paperType];
    }
    const questions = Array.from({ length: totalQuestions }, (_, i) => ({
      id: i + 1,
      text: `Random ${typeList[i % typeList.length]} Question ${i + 1}`,
      type: typeList[i % typeList.length],
      marks: typeList[i % typeList.length] === "MCQ" ? 1 : typeList[i % typeList.length] === "Text" ? 1 : 2,
    }));
    setGeneratedQuestions(questions);
    
    // If Mixed type, go to type-allocation, otherwise go directly to preview
    if (paperType === "Mixed") {
      setCurrentStep("type-allocation");
    } else {
      setCurrentStep("preview");
    }
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-card animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white mb-2 flex items-center justify-center">
              <span className="mr-2">📘</span> Random Paper
            </CardTitle>
            <div className="text-white mb-2">
              {board} - {standard} - {subject}
            </div>
            <Button variant="ghost" className="mt-2" onClick={onBack}>
              ← Back
            </Button>
          </CardHeader>
          
          {/* Step 1: Configuration */}
          {currentStep === "config" && (
            <CardContent>
              <div className="mb-6">
                <Label className="text-white mb-2 block">Number of Questions</Label>
                <div className="flex gap-4 mb-2">
                  {questionCounts.map((count) => (
                    <Button
                      key={count}
                      className={`rounded-full px-6 py-2 ${numQuestions === count && !customQuestions ? "bg-white text-blue-700" : "bg-blue-600 text-white"}`}
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
              <div className="mb-6">
                <Label className="text-white mb-2 block">Paper Type</Label>
                <div className="flex gap-4">
                  {paperTypes.map((type) => (
                    <Button
                      key={type}
                      className={`rounded-full px-6 py-2 ${paperType === type ? "bg-white text-blue-700" : "bg-blue-600 text-white"}`}
                      onClick={() => setPaperType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-white text-blue-700 rounded-lg py-3 text-lg font-bold" onClick={handleGenerate}>
                Generate Paper
              </Button>
            </CardContent>
          )}

          {/* Step 2: Type Allocation (only for Mixed papers) */}
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
                      className="min-w-32 bg-white text-blue-700 hover:bg-white/90"
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
              <div className="mb-4 text-blue-700 text-xl font-semibold">Preview</div>
              <div className="bg-white rounded-lg p-6 mb-4 shadow-md">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="mb-4 pb-2 border-b">
                    <div className="font-bold text-lg flex gap-2">
                      <span>Q{i + 1}.</span>
                      <LatexPreview content={q.text} />
                    </div>
                    <div className="text-sm text-gray-500">Type: {q.type} • Marks: {q.marks || 'N/A'}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Download PDF</Button>
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Print Paper</Button>
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Save for Later</Button>
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
