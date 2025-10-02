import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import LatexPreview from './LatexPreview';

const LatexTest = () => {
  const [testContent, setTestContent] = useState('Q1. Solve for x: $x^2 + 5x + 6 = 0$\n\nQ2. Find the derivative of $f(x) = \\sin(x^2)$\n\nQ3. Calculate the integral:\n$$\\int_0^1 x^2 dx$$\n\nQ4. The quadratic formula is: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$');

  const examples = [
    'Simple: $x^2$',
    'Fraction: $\\frac{a}{b}$',
    'Square root: $\\sqrt{x}$',
    'Summation: $\\sum_{i=1}^{n} i$',
    'Display math: $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$',
    'Matrix: $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$',
    'Greek letters: $\\alpha, \\beta, \\gamma, \\delta$',
    'Limits: $\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1$'
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>LaTeX Preview Test</CardTitle>
          <CardDescription>
            Test the LaTeX rendering functionality. Use $...$ for inline math and $$...$$ for display math.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-content">Test Content</Label>
            <Textarea
              id="test-content"
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              className="min-h-[200px]"
              placeholder="Enter text with LaTeX expressions..."
            />
          </div>
          
          <div>
            <Label>Preview</Label>
            <div className="p-4 border rounded-md bg-gray-50">
              <LatexPreview content={testContent} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LaTeX Examples</CardTitle>
          <CardDescription>
            Click on any example to test it in the textarea above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examples.map((example, index) => (
              <div
                key={index}
                className="p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                onClick={() => setTestContent(example)}
              >
                <div className="text-sm text-gray-600 mb-2">Example {index + 1}:</div>
                <LatexPreview content={example} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LatexTest;
