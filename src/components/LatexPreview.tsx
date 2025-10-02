import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface LatexPreviewProps {
  content: string;
  displayMode?: boolean;
  className?: string;
}

const LatexPreview: React.FC<LatexPreviewProps> = ({ 
  content, 
  displayMode = false, 
  className = "" 
}) => {
  // Function to extract LaTeX expressions from text
  const renderLatexContent = (text: string) => {
    if (!text) return text;
    
    // Split text by LaTeX expressions (both inline $...$ and display $$...$$)
    const parts = text.split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Display mode LaTeX
        const latexContent = part.slice(2, -2).trim();
        return (
          <BlockMath key={index} math={latexContent} />
        );
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline LaTeX
        const latexContent = part.slice(1, -1).trim();
        return (
          <InlineMath key={index} math={latexContent} />
        );
      } else {
        // Regular text
        return <span key={index}>{part}</span>;
      }
    });
  };

  try {
    if (displayMode) {
      // If displayMode is true, render the entire content as a block math
      return (
        <div className={className}>
          <BlockMath math={content} />
        </div>
      );
    }
    
    // Otherwise, parse and render mixed content
    return (
      <div className={className}>
        {renderLatexContent(content)}
      </div>
    );
  } catch (error) {
    // If LaTeX parsing fails, return the original content
    console.warn('LaTeX parsing error:', error);
    return <div className={className}>{content}</div>;
  }
};

export default LatexPreview;
