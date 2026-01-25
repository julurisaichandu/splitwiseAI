import React, { useState } from 'react';

interface ApiKeys {
  SPLITWISE_CONSUMER_KEY: string;
  SPLITWISE_SECRET_KEY: string;
  SPLITWISE_API_KEY: string;
  GEMINI_API_KEY: string;
}

interface Item {
  name: string;
  price: number;
  split_price: number;
  members: Record<string, boolean>;
}

interface ReceiptMetadata {
  store: string;
  delivery_date: string;
  delivery_time: string;
  subtotal: number;
  fees: {
    bag_fee: number;
    bag_fee_tax: number;
    service_fee: number;
    delivery_discount: number;
  };
  total: number;
  validation_passed: boolean;
  calculated_subtotal: number;
}

interface PDFUploaderProps {
  apiKeys: ApiKeys;
  onItemsDetected: (items: Item[], metadata: ReceiptMetadata) => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ apiKeys, onItemsDetected }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type === 'application/pdf' || selected.name.endsWith('.pdf')) {
        setFile(selected);
        setError(null);
      } else {
        setError('Please select a PDF file');
        setFile(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  const analyzePDF = async () => {
    if (!file) {
      alert('Please upload a PDF file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gemini_key', apiKeys.GEMINI_API_KEY);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/analyze-pdf`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze PDF');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        onItemsDetected(data.items, data.metadata);
      } else {
        alert('No items detected in the PDF');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to analyze PDF';
      setError(message);
      alert(`Error: ${message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="w-full"
        />
        <p className="text-sm text-gray-500 mt-2">
          Upload Instacart receipt PDF
        </p>
      </div>

      {file && (
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
            <span className="text-xs text-gray-500">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={removeFile}
            className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <button
        onClick={analyzePDF}
        disabled={isAnalyzing || !file}
        className={`w-full py-2 px-4 rounded text-white ${
          isAnalyzing || !file
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isAnalyzing ? 'Analyzing PDF...' : 'Analyze PDF Receipt'}
      </button>
    </div>
  );
};

export default PDFUploader;
