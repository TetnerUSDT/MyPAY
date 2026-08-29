import { Router as WouterRouter } from "wouter";
import { Layout as P2PDesktopLayout } from "@/components/layout";
import { useP2PDesktop } from "@/hooks/use-p2p-desktop";
import DesktopOrderDetail from "@/pages/order-detail";
import MobileOrderDetail from "@/pages/p2p-order";

export default function P2POrderResponsive() {
  const isDesktop = useP2PDesktop();

  if (!isDesktop) {
    return <MobileOrderDetail />;
  }

  return (
    <WouterRouter base="/p2p">
      <P2PDesktopLayout>
        <DesktopOrderDetail backPath="/" />
      </P2PDesktopLayout>
    </WouterRouter>
  );
}