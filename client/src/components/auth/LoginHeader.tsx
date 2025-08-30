import { Fuel } from 'lucide-react';

export function LoginHeader() {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl mb-3 border border-white/20">
        <Fuel className="h-6 w-6 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
        NumzFleet
      </h1>
      <p className="text-blue-200 text-sm">
        Fleet Management System
      </p>
    </div>
  );
}
