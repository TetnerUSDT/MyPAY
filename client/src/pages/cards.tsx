import { useState } from "react";
import { X, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Card {
  id: string;
  name: string;
  number: string;
  country: string;
}

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    number: ""
  });

  const handleAddCard = () => {
    if (formData.name && formData.country && formData.number) {
      const newCard: Card = {
        id: Date.now().toString(),
        name: formData.name,
        number: formData.number,
        country: formData.country,
      };
      setCards([...cards, newCard]);
      setFormData({ name: "", country: "", number: "" });
      setIsModalOpen(false);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    setCards(cards.filter(card => card.id !== cardId));
  };

  const formatCardNumber = (number: string) => {
    return number.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters
    const numericValue = e.target.value.replace(/\D/g, '');
    
    // Limit to 16 digits
    const limitedValue = numericValue.slice(0, 16);
    
    // Add spaces every 4 digits for display
    const formattedValue = limitedValue.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    // Update form state with raw numeric value
    setFormData({ ...formData, number: limitedValue });
    
    // Update input display value
    e.target.value = formattedValue;
  };

  return (
    <div className="mobile-screen gradient-bg text-white">
      <div className="flex flex-col h-full">
        {/* Title */}
        <div className="text-center pt-8 pb-16">
          <h1 className="text-xl font-semibold" data-testid="text-cards-title">
            Сохраненные карты
          </h1>
        </div>
        
        {cards.length === 0 ? (
          /* Empty State */
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
        ) : (
          /* Cards List */
          <div className="flex-1 px-6 py-4">
            <div className="space-y-4">
              {cards.map((card) => (
                <div 
                  key={card.id}
                  className="crypto-card flex items-center justify-between p-4"
                  data-testid={`card-${card.id}`}
                >
                  <div className="flex items-center">
                    {/* Card Icon */}
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mr-4">
                      <CreditCard className="w-6 h-6 text-accent-foreground" />
                    </div>
                    
                    {/* Card Info */}
                    <div>
                      <h3 className="font-semibold text-white text-sm" data-testid={`card-name-${card.id}`}>
                        {card.name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid={`card-number-${card.id}`}>
                        {formatCardNumber(card.number)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Country */}
                    <span className="text-sm text-white" data-testid={`card-country-${card.id}`}>
                      {card.country}
                    </span>
                    
                    {/* Delete Button */}
                    <button 
                      className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center"
                      onClick={() => handleDeleteCard(card.id)}
                      data-testid={`button-delete-${card.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Add Card Button */}
        <div className="p-6">
          <button 
            className="action-button"
            onClick={() => setIsModalOpen(true)}
            data-testid="button-add-card"
          >
            Добавить номер карты
          </button>
        </div>
      </div>

      {/* Add Card Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="mobile-screen bg-secondary border-none text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Добавление карты</DialogTitle>
          </DialogHeader>
          
          <div className="crypto-card mt-4">
            {/* Card Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-accent-foreground" />
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Card Name */}
              <div>
                <Label htmlFor="cardName" className="text-white mb-2 block">
                  Введите название для карты
                </Label>
                <Input
                  id="cardName"
                  placeholder="Зарплатная карта"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  data-testid="input-card-name"
                />
              </div>

              {/* Country Selection */}
              <div>
                <Label className="text-white mb-2 block">
                  Выберите страну
                </Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger className="input-field" data-testid="select-country">
                    <SelectValue placeholder="РОССИЯ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="РОССИЯ">РОССИЯ</SelectItem>
                    <SelectItem value="УКРАИНА">УКРАИНА</SelectItem>
                    <SelectItem value="БЕЛАРУСЬ">БЕЛАРУСЬ</SelectItem>
                    <SelectItem value="КАЗАХСТАН">КАЗАХСТАН</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Card Number */}
              <div>
                <Label htmlFor="cardNumber" className="text-white mb-2 block">
                  Введите номер карты
                </Label>
                <Input
                  id="cardNumber"
                  placeholder="4373 8349 9348 7328"
                  value={formatCardNumber(formData.number)}
                  onChange={handleCardNumberChange}
                  className="input-field"
                  data-testid="input-card-number"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button 
              className="action-button"
              onClick={handleAddCard}
              data-testid="button-save-card"
            >
              Сохранить карту
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}