"use client";
// import { useRouter } from 'next/router';
import BillSplitter from '../components/BillSplitter';

export default function Home() {
//   const router = useRouter();
// 
//   const handleInitialized = () => {
//     router.push('/bill-splitter');
//   };

  return (
    <div className="container mx-auto px-4 py-8">

        <h1 className="text-3xl font-bold text-center mb-8">Itemized Bill Splitter</h1>
        {/* <ApiKeyForm onInitialized={handleInitialized} /> */}
        <BillSplitter />
      
    </div>
  );
}
