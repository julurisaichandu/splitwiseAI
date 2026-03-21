import React, { useState } from 'react';
import Spinner from './Spinner';
import { useAuth } from './AuthContext';

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
  onItemsDetected: (items: Item[], metadata: ReceiptMetadata) => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onItemsDetected }) => {
  const { authFetch } = useAuth();
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
      setError('Please upload a PDF file');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch(
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
        setError('No items detected in the PDF');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to analyze PDF';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 p-5 rounded-xl bg-slate-50 hover:border-slate-400 transition-colors duration-150">
        <div className="flex flex-col items-center justify-center gap-3">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-center">
            <label className="cursor-pointer">
              <span className="text-emerald-500 hover:text-emerald-600 font-medium">Upload PDF</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <span className="text-slate-500"> or drag and drop</span>
          </div>
          <p className="text-xs text-slate-400">Instacart receipt PDF supported</p>
        </div>
      </div>

      {file && (
        <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={removeFile}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Remove file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <button
        onClick={analyzePDF}
        disabled={isAnalyzing || !file}
        className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isAnalyzing || !file
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-500 active:scale-[0.98]'
          }`}
      >
        {isAnalyzing ? (
          <>
            <Spinner size="sm" />
            <span>Analyzing PDF...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Analyze PDF Receipt</span>
          </>
        )}
      </button>
    </div>
  );
};

export default PDFUploader;
