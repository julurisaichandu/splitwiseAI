import React, { useState } from 'react';

interface ApiKeys {
  SPLITWISE_CONSUMER_KEY: string;
  SPLITWISE_SECRET_KEY: string;
  SPLITWISE_API_KEY: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string; 

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

interface BillUploaderProps {
  apiKeys: ApiKeys;
  onItemsDetected: (items: Item[]) => void;
}

const BillUploader: React.FC<BillUploaderProps> = ({ apiKeys, onItemsDetected }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [pastedImages, setPastedImages] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    
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
      alert('Please upload at least one bill image');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('groq_key', apiKeys.GROQ_API_KEY); // Changed from gemini_key
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`+'/api/analyze-bills', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze bills');
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        onItemsDetected(data.items);
      } else {
        alert('No items detected in the bills');
      }
    } catch (error) {
      console.error(error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to analyze bills'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="w-full"
        />
        <div 
          onPaste={handlePaste}
          className="border-2 border-dashed border-blue-300 p-4 rounded-lg mt-4 bg-blue-50 cursor-pointer"
          tabIndex={0}
        >
          <p className="text-center text-blue-600">
            Click here and paste screenshot (Ctrl+V / Cmd+V)
          </p>
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Upload bill images (JPG, JPEG, PNG)
        </p>
      </div>
      
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              <img 
                src={preview.url} 
                alt={`Bill ${index + 1}`} 
                className="w-full h-32 object-cover rounded"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <button
        onClick={analyzeBills}
        disabled={isAnalyzing || files.length === 0}
        className={`w-full py-2 px-4 rounded text-white ${
          isAnalyzing || files.length === 0 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Bills'}
      </button>
    </div>
  );
};

export default BillUploader;
