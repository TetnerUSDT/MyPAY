import CreateAd from "@/pages/create-ad";
import { P2PWorkspaceModal } from "@/components/p2p-modal";

export function CreateAdModal({ onClose }: { onClose: () => void }) {
  return (
    <P2PWorkspaceModal title="Создать объявление" kicker="Новый оффер" onClose={onClose}>
      <CreateAd onClose={onClose} />
    </P2PWorkspaceModal>
  );
}