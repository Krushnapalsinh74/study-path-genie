import React from "react";
import { useNavigate } from "react-router-dom";
import CreatedPapers from "@/components/CreatedPapers";

const CreatedPapersPage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/");
  };

  return <CreatedPapers onBack={handleBack} />;
};

export default CreatedPapersPage;
