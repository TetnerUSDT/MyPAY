import { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Card {
  id: string;
  name: string;
  number: string;
  country: string;
  firstName: string;
  lastName: string;
  phone: string;
  idUser: number;
  idCard: number;
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
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    number: "",
    firstName: "",
    lastName: "",
    phone: "",
    idCard: ""
  });

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ['/api/user-cards']
  });

  const { data: activeCards = [] } = useQuery<any[]>({
    queryKey: ['/api/cards/active']
  });

  const createCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      
      const response = await fetch('/api/user-cards', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(cardData)
      });
      if (!response.ok) throw new Error('Failed to create card');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-cards'] });
      setFormData({ name: "", country: "", number: "", firstName: "", lastName: "", phone: "", idCard: "" });
      setIsModalOpen(false);
      toast({ title: "Карта добавлена успешно" });
    },
    onError: () => {
      toast({ title: "Ошибка при добавлении карты", variant: "destructive" });
    }
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const apiKey = localStorage.getItem("userApiKey");
      const headers: Record<string, string> = {};
      if (apiKey) headers['x-api-key'] = apiKey;
      
      const response = await fetch(`/api/user-cards/${cardId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete card');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-cards'] });
      toast({ title: "Карта удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка при удалении карты", variant: "destructive" });
    }
  });

  const handleAddCard = () => {
    if (formData.name && formData.country && formData.number && formData.firstName && formData.lastName && formData.phone && formData.idCard) {
      createCardMutation.mutate(formData);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    deleteCardMutation.mutate(cardId);
  };

  const formatCardNumber = (number: string) => {
    return number.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters and limit to 16 digits
    const numericValue = e.target.value.replace(/\D/g, '').slice(0, 16);
    
    // Update form state with raw numeric value
    setFormData({ ...formData, number: numericValue });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract only digits from input, limit to 15 digits per E.164 standard
    const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
    
    // Always format with leading +
    const formattedPhone = '+' + digits;
    
    // Update form state
    setFormData({ ...formData, phone: formattedPhone });
  };

  const handleNameChange = (field: 'firstName' | 'lastName') => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow Latin characters and spaces
    const latinValue = e.target.value.replace(/[^a-zA-Z\s]/g, '');
    setFormData({ ...formData, [field]: latinValue });
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

              {/* First Name */}
              <div>
                <Label htmlFor="firstName" className="text-white mb-2 block">
                  Имя (латинницей)
                </Label>
                <Input
                  id="firstName"
                  placeholder="Ivan"
                  value={formData.firstName}
                  onChange={handleNameChange('firstName')}
                  className="input-field"
                  data-testid="input-first-name"
                />
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastName" className="text-white mb-2 block">
                  Фамилия (латинницей)
                </Label>
                <Input
                  id="lastName"
                  placeholder="Petrov"
                  value={formData.lastName}
                  onChange={handleNameChange('lastName')}
                  className="input-field"
                  data-testid="input-last-name"
                />
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="phone" className="text-white mb-2 block">
                  Номер телефона
                </Label>
                <Input
                  id="phone"
                  placeholder="+79991234567"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="input-field"
                  data-testid="input-phone"
                />
              </div>

              {/* Country Selection */}
              <div>
                <Label className="text-white mb-2 block">
                  Выберите страну
                </Label>
                <Select
                  value={formData.idCard}
                  onValueChange={(value) => {
                    const selectedCard = activeCards.find(c => c.id.toString() === value);
                    setFormData({ 
                      ...formData, 
                      idCard: value,
                      country: selectedCard?.country || ""
                    });
                  }}
                >
                  <SelectTrigger className="input-field" data-testid="select-country">
                    <SelectValue placeholder="Выберите страну" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCards.map(card => (
                      <SelectItem key={card.id} value={card.id.toString()}>
                        {card.country}
                      </SelectItem>
                    ))}
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