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
import { RussiaFlag, TurkeyFlag } from "@/components/flags";

interface Card {
  id: number;
  name: string;
  numberCard?: string;
  number?: string;
  accountNumber?: string;
  country: string;
  firstName: string;
  lastName: string;
  phone: string;
  idUser: number;
  idCard: number;
  idBank?: number | null;
  bankName?: string | null;
}

interface CountryCard {
  id: number;
  title: string;
  country: string;
  lang: string | null;
  timeExchange: number;
  commission: string;
  idBalance: string | null;
  status: string | null;
}

interface Bank {
  id: number;
  cardId: number;
  bankName: string;
  timeExchange: number | null;
  commission: string | null;
  status: string | null;
}

// Map language codes to flag components
const flagMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  ru: RussiaFlag,
  tr: TurkeyFlag,
};

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
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    number: "",
    accountNumber: "",
    firstName: "",
    lastName: "",
    phone: "",
    idCard: "",
    idBank: ""
  });

  const { data: cards = [], isLoading } = useQuery<Card[]>({
    queryKey: ['/api/user-cards']
  });

  const { data: activeCards = [] } = useQuery<CountryCard[]>({
    queryKey: ['/api/cards/active']
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ['/api/banks', selectedCardId],
    queryFn: async () => {
      const response = await fetch(`/api/banks/${selectedCardId}`);
      if (!response.ok) throw new Error('Failed to fetch banks');
      return response.json();
    },
    enabled: !!selectedCardId && selectedCardId !== ""
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
      setFormData({ name: "", country: "", number: "", accountNumber: "", firstName: "", lastName: "", phone: "", idCard: "", idBank: "" });
      setSelectedCardId("");
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
    // Validate: требуется либо номер карты, либо номер счета
    if (!formData.name || !formData.country || !formData.firstName || !formData.lastName || !formData.phone || !formData.idCard) {
      toast({ title: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    
    if (!formData.number && !formData.accountNumber) {
      toast({ title: "Заполните номер карты или номер счета", variant: "destructive" });
      return;
    }

    const dataToSend: any = {
      name: formData.name,
      country: formData.country,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      idCard: formData.idCard
    };
    
    if (formData.number) {
      dataToSend.number = formData.number;
    }
    
    if (formData.accountNumber) {
      dataToSend.accountNumber = formData.accountNumber;
    }
    
    if (formData.idBank) {
      dataToSend.idBank = parseInt(formData.idBank);
    }
    
    createCardMutation.mutate(dataToSend);
  };

  const handleDeleteCard = (cardId: number) => {
    deleteCardMutation.mutate(cardId.toString());
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

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, '').slice(0, 20);
    setFormData({ ...formData, accountNumber: numericValue });
  };

  return (
    <div className="mobile-screen gradient-bg text-white pb-24">
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
                  className="crypto-card p-4"
                  data-testid={`card-${card.id}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      {/* Card Icon */}
                      <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mr-3">
                        <CreditCard className="w-6 h-6 text-accent-foreground" />
                      </div>
                      
                      {/* Card Name and Details */}
                      <div>
                        <h3 className="font-semibold text-accent text-base mb-1" data-testid={`card-name-${card.id}`}>
                          {card.name}
                        </h3>
                        {card.bankName && (
                          <p className="text-sm text-white/70 mb-1" data-testid={`card-bank-${card.id}`}>
                            {card.bankName}
                          </p>
                        )}
                        <p className="text-sm text-white" data-testid={`card-phone-${card.id}`}>
                          {card.phone}
                        </p>
                        <p className="text-sm text-white" data-testid={`card-owner-${card.id}`}>
                          {card.firstName} {card.lastName}
                        </p>
                      </div>
                    </div>
                    
                    {/* Country Flag */}
                    {(() => {
                      const countryCard = activeCards.find(c => c.id === card.idCard);
                      const FlagComponent = countryCard?.lang ? flagMap[countryCard.lang] : null;
                      return FlagComponent ? (
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white/5 border border-white/10"
                          data-testid={`card-country-${card.id}`}
                        >
                          <FlagComponent className="w-8 h-8" />
                        </div>
                      ) : (
                        <span className="text-sm text-white font-medium" data-testid={`card-country-${card.id}`}>
                          {card.country}
                        </span>
                      );
                    })()}
                  </div>
                  
                  {/* Card Number and Delete */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 bg-secondary/50 rounded-lg px-4 py-2 mr-2">
                      <p className="text-white font-mono text-base" data-testid={`card-number-${card.id}`}>
                        {card.numberCard || card.number 
                          ? formatCardNumber(card.numberCard || card.number || '')
                          : card.accountNumber 
                            ? `Счет: ${card.accountNumber}`
                            : ''
                        }
                      </p>
                    </div>
                    
                    {/* Delete Button */}
                    <button 
                      className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center hover:bg-secondary/80 transition-colors"
                      onClick={() => handleDeleteCard(card.id)}
                      data-testid={`button-delete-${card.id}`}
                    >
                      <Trash2 className="w-5 h-5 text-white" />
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
        <DialogContent className="mobile-screen bg-secondary border-none text-white max-h-[90vh] overflow-y-auto">
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
                    setSelectedCardId(value);
                    setFormData({ 
                      ...formData, 
                      idCard: value,
                      country: selectedCard?.country || "",
                      idBank: ""
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

              {/* Bank Selection - shown only if banks are available for selected country */}
              {banks.length > 0 && (
                <div>
                  <Label className="text-white mb-2 block">
                    Выберите банк
                  </Label>
                  <Select
                    value={formData.idBank}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        idBank: value
                      });
                    }}
                  >
                    <SelectTrigger className="input-field" data-testid="select-bank">
                      <SelectValue placeholder="Выберите банк" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.bankName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Card Number */}
              <div>
                <Label htmlFor="cardNumber" className="text-white mb-2 block">
                  Введите номер карты (необязательно)
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

              {/* Account Number */}
              <div>
                <Label htmlFor="accountNumber" className="text-white mb-2 block">
                  Номер счета (20 цифр, необязательно)
                </Label>
                <Input
                  id="accountNumber"
                  placeholder="12345678901234567890"
                  value={formData.accountNumber}
                  onChange={handleAccountNumberChange}
                  className="input-field"
                  data-testid="input-account-number"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Заполните либо номер карты, либо номер счета
                </p>
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