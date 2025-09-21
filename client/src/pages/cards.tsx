import { Link } from "wouter";
import { X } from "lucide-react";

// Card icon component from provided SVG
const CardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 116 116" width="116" height="116" fill="none">
    <svg xmlns="http://www.w3.org/2000/svg" height="116" width="116" viewBox="0 0 24 24" fill="#a5fe7c" opacity="100%">
      <path fill="none" d="M0 0h24v24H0z"/>
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h10v-2H4v-6h18V6c0-1.11-.89-2-2-2m0 4H4V6h16zm4 9v2h-3v3h-2v-3h-3v-2h3v-3h2v3z"/>
    </svg>
  </svg>
);

export default function CardsScreen() {
  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        
        {/* Title */}
        <div className="text-center pt-8 pb-16">
          <h1 className="text-xl font-semibold" data-testid="text-cards-title">
            Сохраненные карты
          </h1>
        </div>
        
        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Card Icon */}
          <div className="mb-8" data-testid="card-icon">
            <CardIcon />
          </div>
          
          {/* Empty Message */}
          <p className="text-center text-lg mb-16 max-w-sm" data-testid="text-empty-message">
            У вас еще нет сохраненных номеров карт
          </p>
        </div>
        
        {/* Add Card Button */}
        <div className="p-6">
          <button 
            className="action-button"
            data-testid="button-add-card"
          >
            Добавить номер карты
          </button>
        </div>
      </div>
    </div>
  );
}