import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNotificationStream } from '@/hooks/use-notification-stream';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useLocation } from 'wouter';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface InvoiceNotificationContextType {
  openInvoice: (invoiceId: number) => void;
}

const InvoiceNotificationContext = createContext<InvoiceNotificationContextType | null>(null);

export function useInvoiceNotification() {
  const context = useContext(InvoiceNotificationContext);
  if (!context) {
    throw new Error('useInvoiceNotification must be used within InvoiceNotificationProvider');
  }
  return context;
}

interface InvoiceNotificationProviderProps {
  children: ReactNode;
}

export function InvoiceNotificationProvider({ children }: InvoiceNotificationProviderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check for pending invoices on mount (offline recovery)
  useEffect(() => {
    const apiKey = localStorage.getItem('userApiKey');
    if (!apiKey) return;

    const checkPendingInvoices = async () => {
      try {
        const response = await fetch('/api/invoices', {
          headers: {
            'X-Api-Key': apiKey
          }
        });
        if (response.ok) {
          const invoices = await response.json();
          
          // Filter out dismissed invoices (by orderNumber)
          const pendingInvoices = invoices.filter((inv: any) => {
            const isPending = inv.status === 'pending' && new Date(inv.expiresAt) > new Date();
            const dismissKey = `dismissed_invoice_${inv.orderNumber}`;
            const isDismissed = localStorage.getItem(dismissKey) === 'true';
            return isPending && !isDismissed;
          });
          
          if (pendingInvoices.length > 0) {
            console.log(`[Offline Recovery] Found ${pendingInvoices.length} pending invoice(s)`);
            // Auto-open first pending invoice
            setSelectedInvoice(pendingInvoices[0]);
            setDrawerOpen(true);
          }
        }
      } catch (error) {
        console.error('[Offline Recovery] Error checking pending invoices:', error);
      }
    };

    // Check after a short delay to ensure app is initialized
    const timer = setTimeout(checkPendingInvoices, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Handle incoming invoice notifications from SSE
  const handleInvoice = (invoiceData: any) => {
    console.log('[Invoice Notification] Received invoice:', invoiceData);
    
    // Don't show bottom sheet on admin pages (when admin and user logged in same browser)
    // Use window.location.pathname as wouter location might not be initialized yet
    if (window.location.pathname.startsWith('/admin')) {
      console.log('[Invoice Notification] Skipping notification on admin page');
      return;
    }
    
    // Check if this invoice was previously dismissed (by orderNumber)
    const dismissKey = `dismissed_invoice_${invoiceData.orderNumber}`;
    if (localStorage.getItem(dismissKey) === 'true') {
      console.log('[Invoice Notification] Skipping dismissed invoice:', invoiceData.orderNumber);
      return;
    }
    
    toast({
      title: "Новый счет на оплату",
      description: `Счет ${invoiceData.orderNumber} на сумму ${invoiceData.amount} ${invoiceData.currency}`,
      duration: 5000,
    });

    // Auto-open invoice drawer
    setSelectedInvoice(invoiceData);
    setDrawerOpen(true);
  };

  // Connect to SSE stream
  useNotificationStream({
    onInvoice: handleInvoice,
    enabled: true
  });

  const openInvoice = (invoiceId: number) => {
    const apiKey = localStorage.getItem('userApiKey');
    if (!apiKey) {
      console.error('[Invoice] No API key available');
      return;
    }

    // Fetch invoice details and open drawer
    fetch(`/api/invoices`, {
      headers: {
        'X-Api-Key': apiKey
      }
    })
      .then(res => res.json())
      .then(invoices => {
        const invoice = invoices.find((inv: any) => inv.id === invoiceId);
        if (invoice) {
          setSelectedInvoice(invoice);
          setDrawerOpen(true);
        }
      })
      .catch(error => {
        console.error('Error fetching invoice:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить счет",
          variant: "destructive"
        });
      });
  };

  const handleViewInvoice = () => {
    if (selectedInvoice) {
      // Mark invoice as dismissed when user opens it (user already saw the notification)
      const dismissKey = `dismissed_invoice_${selectedInvoice.orderNumber}`;
      localStorage.setItem(dismissKey, 'true');
      console.log('[Invoice Notification] Marked as dismissed (opened):', selectedInvoice.orderNumber);
      
      navigate(`/invoice/${selectedInvoice.orderNumber}`);
      setDrawerOpen(false);
    }
  };

  const handleDismiss = () => {
    // Mark invoice as dismissed to prevent showing again
    if (selectedInvoice?.orderNumber) {
      const dismissKey = `dismissed_invoice_${selectedInvoice.orderNumber}`;
      localStorage.setItem(dismissKey, 'true');
      console.log('[Invoice Notification] Dismissed invoice:', selectedInvoice.orderNumber);
    }
    setDrawerOpen(false);
  };

  return (
    <InvoiceNotificationContext.Provider value={{ openInvoice }}>
      {children}
      
      {/* Invoice Notification Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-gradient-to-b from-green-800 to-green-900 border-green-600/30">
          <DrawerHeader>
            <DrawerTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              Счет на оплату
            </DrawerTitle>
            <DrawerDescription className="text-green-200">
              Вам выставлен новый счет
            </DrawerDescription>
          </DrawerHeader>

          {selectedInvoice && (
            <div className="px-4 py-6 space-y-4">
              {/* Invoice Details */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-green-200">Номер заказа:</span>
                  <span className="text-white font-semibold">{selectedInvoice.orderNumber}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-green-200">Сумма:</span>
                  <span className="text-white font-bold text-xl">
                    {selectedInvoice.amount} {selectedInvoice.currency}
                  </span>
                </div>
                
                {selectedInvoice.description && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-green-200 text-sm">Описание:</span>
                    <p className="text-white mt-1">{selectedInvoice.description}</p>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-yellow-300 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    Оплатить до {new Date(selectedInvoice.expiresAt).toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 py-2">
                {selectedInvoice.status === 'pending' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-300">Ожидает оплаты</span>
                  </>
                )}
                {selectedInvoice.status === 'paid' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-green-300">Оплачен</span>
                  </>
                )}
              </div>
            </div>
          )}

          <DrawerFooter className="px-4 pb-6">
            <Button 
              onClick={handleViewInvoice}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-view-invoice"
            >
              Открыть счет
            </Button>
            <Button 
              onClick={handleDismiss}
              variant="outline"
              className="w-full border-green-600/50 text-green-200 hover:bg-white/10"
              data-testid="button-dismiss-invoice"
            >
              Закрыть
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </InvoiceNotificationContext.Provider>
  );
}
