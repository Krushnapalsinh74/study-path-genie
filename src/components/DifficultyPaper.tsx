import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Label } from "@/components/ui";
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
  const [preview, setPreview] = useState(false);

  const handleGenerate = async () => {
    // TODO: Replace with actual API call
    let questions = [];
    if (useCustomRatio) {
      const total = numQuestions;
      const easyCount = Math.round((customRatio.easy / 100) * total);
      const mediumCount = Math.round((customRatio.medium / 100) * total);
      const hardCount = total - easyCount - mediumCount;
      questions = [
        ...Array.from({ length: easyCount }, (_, i) => ({ id: `e${i+1}`, text: `Easy Question ${i+1}`, type: "easy" })),
        ...Array.from({ length: mediumCount }, (_, i) => ({ id: `m${i+1}`, text: `Medium Question ${i+1}`, type: "medium" })),
        ...Array.from({ length: hardCount }, (_, i) => ({ id: `h${i+1}`, text: `Hard Question ${i+1}`, type: "hard" })),
      ];
    } else {
      questions = Array.from({ length: numQuestions }, (_, i) => ({
        id: i + 1,
        text: `${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)} Question ${i + 1}`,
        type: selectedDifficulty,
      }));
    }
    setGeneratedQuestions(questions);
    setPreview(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-700 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-card animate-fade-in">
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
          {!preview ? (
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
          ) : (
            <CardContent>
              <div className="mb-4 text-white text-xl font-semibold">Preview</div>
              <div className="bg-white rounded-lg p-4 mb-4">
                {generatedQuestions.map((q, i) => (
                  <div key={q.id} className="mb-3">
                    <div className="font-bold flex gap-2">
                      <span>Q{i + 1}.</span>
                      <LatexPreview content={q.text} />
                    </div>
                    <div className="text-sm text-gray-500">Type: {q.type}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Download PDF</Button>
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Print Paper</Button>
                <Button className="bg-green-600 text-white rounded-lg px-6 py-2">Save for Later</Button>
              </div>
              <Button variant="ghost" className="mt-6" onClick={() => setPreview(false)}>
                ← Back to Options
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
