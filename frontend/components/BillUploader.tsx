import React, { useState } from 'react';
import Spinner from './Spinner';

interface ApiKeys {
  SPLITWISE_CONSUMER_KEY: string;
  SPLITWISE_SECRET_KEY: string;
  SPLITWISE_API_KEY: string;
  GEMINI_API_KEY: string;
}

interface Preview {
  file: File;
  url: string;
}

interface Item {
  name: string;
  price: number;
  split_price: number;
  members: Record<string, boolean>;
}

interface ReceiptMetadata {
  store: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
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

interface BillUploaderProps {
  apiKeys: ApiKeys;
  onItemsDetected: (items: Item[], metadata: ReceiptMetadata | null) => void;
}

const BillUploader: React.FC<BillUploaderProps> = ({ apiKeys, onItemsDetected }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError(null);

    // Generate previews
    const newPreviews = selectedFiles.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));

    setPreviews(newPreviews);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          // Convert blob to File with proper name
          const file = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: blob.type,
          });
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      const allFiles = [...files, ...imageFiles];
      setFiles(allFiles);
      setError(null);

      // Generate previews for pasted images
      const newPreviews = imageFiles.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));
      setPreviews([...previews, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index].url);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const analyzeBills = async () => {
    if (files.length === 0) {
      setError('Please upload at least one bill image');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('gemini_key', apiKeys.GEMINI_API_KEY);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}` + '/api/analyze-bills', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze bills');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        onItemsDetected(data.items, data.metadata);
      } else {
        setError('No items detected in the bills');
      }
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : 'Failed to analyze bills');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-stone-300 p-5 rounded-xl bg-stone-50 hover:border-stone-400 transition-colors duration-150">
        <div className="flex flex-col items-center justify-center gap-3">
          <svg className="w-10 h-10 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-center">
            <label className="cursor-pointer">
              <span className="text-amber-600 hover:text-amber-700 font-medium">Upload images</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <span className="text-stone-500"> or drag and drop</span>
          </div>
          <p className="text-xs text-stone-400">JPG, JPEG, PNG supported</p>
        </div>

        <div
          onPaste={handlePaste}
          className="border-2 border-dashed border-amber-300 p-4 rounded-lg mt-4 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500"
          tabIndex={0}
        >
          <p className="text-center text-amber-700 text-sm font-medium">
            Click here and paste screenshot (Ctrl+V / Cmd+V)
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview.url}
                alt={`Bill ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-stone-200"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={analyzeBills}
        disabled={isAnalyzing || files.length === 0}
        className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isAnalyzing || files.length === 0
            ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
            : 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 active:scale-[0.98]'
          }`}
      >
        {isAnalyzing ? (
          <>
            <Spinner size="sm" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Analyze Bills</span>
          </>
        )}
      </button>
    </div>
  );
};

export default BillUploader;
