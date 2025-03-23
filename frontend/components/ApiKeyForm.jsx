import { useState, useEffect } from 'react';
// import { saveApiKeys, getApiKeys } from '../utils/storage';
function getApiKeys() {
    return {
      SPLITWISE_CONSUMER_KEY: process.env.NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY,
      SPLITWISE_SECRET_KEY: process.env.NEXT_PUBLIC_SPLITWISE_SECRET_KEY,
      SPLITWISE_API_KEY: process.env.NEXT_PUBLIC_SPLITWISE_API_KEY,
      GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY
    };
  }

export default function ApiKeyForm({ onInitialized }) {
  const [apiKeys, setApiKeys] = useState({
    SPLITWISE_CONSUMER_KEY: '',
    SPLITWISE_SECRET_KEY: '',
    SPLITWISE_API_KEY: '',
    GEMINI_API_KEY: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedKeys = getApiKeys();
    if (savedKeys) {
      setApiKeys(savedKeys);
    }
  }, []);

  const handleApiKeyChange = (e) => {
    const { name, value } = e.target;
    setApiKeys(prev => ({ ...prev, [name]: value }));
  };

  const handleInitialize = async () => {
    if (!allKeysProvided()) {
      alert('Please provide all API keys');
      return;
    }
    
    setIsLoading(true);
    
    try {
        console.log('url', `${process.env.NEXT_PUBLIC_API_URL}`+'/api/initialize');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`+'/api/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeys)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Initialization failed');
      }
      
    //   saveApiKeys(apiKeys);
      onInitialized();
    } catch (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const allKeysProvided = () => {
    return Object.values(apiKeys).every(key => key.trim() !== '');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Enter API Keys</h2>
      
      {Object.keys(apiKeys).map(key => (
        <div key={key} className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor={key}>
            {key}:
          </label>
          <input
            type="password"
            id={key}
            name={key}
            value={apiKeys[key]}
            onChange={handleApiKeyChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      ))}
      
      <button
        onClick={handleInitialize}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded text-white ${isLoading || !allKeysProvided() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        {isLoading ? 'Initializing...' : 'Initialize'}
      </button>
    </div>
  );
}
