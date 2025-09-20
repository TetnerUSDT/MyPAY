import { Link } from "wouter";
import { Bitcoin } from "lucide-react";

export default function SplashScreen() {
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 relative">
        {/* Floating cards background effect */}
        <div className="absolute top-20 left-8 w-32 h-20 glass-effect rounded-xl opacity-50 transform rotate-12"></div>
        <div className="absolute top-32 right-12 w-24 h-16 glass-effect rounded-xl opacity-40 transform -rotate-6"></div>
        <div className="absolute bottom-40 left-16 w-28 h-18 glass-effect rounded-xl opacity-30 transform rotate-6"></div>
        
        {/* Main card with branding */}
        <div className="relative z-10 w-full max-w-sm mb-12">
          <div className="gradient-accent rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-3">
                <Bitcoin className="w-8 h-8 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold text-accent-foreground">SwiftX</h1>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">Быстрый и надежный</h2>
        <h3 className="text-xl font-semibold mb-12">обмен криптовалют</h3>
        
        <Link href="/country" className="w-full max-w-sm">
          <button 
            className="action-button"
            data-testid="button-start-agreement"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Перейти к соглашению
          </button>
        </Link>
      </div>
    </div>
  );
}
