import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Label, Checkbox } from "@/components/ui";
import LatexPreview from "./LatexPreview";

const questionCounts = [10, 20, 30, 50];
const paperTypes = ["MCQ", "Short Answer", "Mixed"];

export default function RandomPaper({ subject, standard, board, onBack }) {
  const [numQuestions, setNumQuestions] = useState(10);
  const [customQuestions, setCustomQuestions] = useState("");
  const [paperType, setPaperType] = useState("Mixed");
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [preview, setPreview] = useState(false);

  const handleGenerate = async () => {
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
      text: `Random ${typeList[i % typeList.length]} Question ${i + 1}`,
      type: typeList[i % typeList.length],
    }));
    setGeneratedQuestions(questions);
    setPreview(true);
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 p-4">
      <div className="max-w-2xl mx-auto">
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
          {!preview ? (
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
          ) : (
            <CardContent>
              <div className="mb-4 text-blue-700 text-xl font-semibold">Preview</div>
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
              <div className="flex gap-4">
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Download PDF</Button>
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Print Paper</Button>
                <Button className="bg-blue-600 text-white rounded-lg px-6 py-2">Save for Later</Button>
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
