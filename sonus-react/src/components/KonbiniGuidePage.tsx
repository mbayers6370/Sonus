import { Navigate } from 'react-router-dom';
import { type TravelSectionData } from '../data/travelModeData';
import { normalizeLanguageId } from '../lib/languageRuntime';
import TravelSectionPage from './TravelSectionPage';

interface KonbiniGuidePageProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  selectedLanguage?: string | null;
}

const KONBINI_SECTION: TravelSectionData = {
  id: 'konbini',
  title: 'Konbini Guide',
  themeColor: '#186E95',
  tone: 'Fast + practical',
  focus: 'Checkout, Food Prep, & Payment at Convenience Stores',
  scene: 'You are at the register and need smooth Japanese for bags, heating, payment, and receipts.',
  subclusters: ['Checkout', 'Bags', 'Heated food', 'Cashless payment'],
  culturalNotes: [
    'What Konbini Means::Convenience stores in Japan are called konbini. They are open long hours and used for much more than snacks.',
    'At the Register::Staff may ask whether you need a bag, want food heated, or have a point card.',
    'Bag Fees::Many stores charge for plastic bags, so saying you do not need one is useful.',
    'Payment Flexibility::Most konbini accept cash, credit cards, IC cards, and phone payments.',
    'Receipts & Small Requests::It is normal to ask for a receipt, utensils, or to have food heated at checkout.',
  ],
  phrases: [
    { id: 'ko-1', script: '袋はいりません。', pronunciation: 'fukuro wa irimasen', english: "I don't need a bag." },
    { id: 'ko-2', script: '袋をお願いします。', pronunciation: 'fukuro o onegaishimasu', english: 'A bag, please.' },
    { id: 'ko-3', script: '温めてください。', pronunciation: 'atatamete kudasai', english: 'Please heat this up.' },
    { id: 'ko-4', script: 'このままで大丈夫です。', pronunciation: 'kono mama de daijoubu desu', english: 'This is fine as is.' },
    { id: 'ko-5', script: 'レシートをください。', pronunciation: 'reshiito o kudasai', english: 'Please give me the receipt.' },
    { id: 'ko-6', script: 'クレジットカードで払います。', pronunciation: 'kurejitto kaado de haraimasu', english: "I'll pay by credit card." },
    { id: 'ko-7', script: '電子マネーで払えますか？', pronunciation: 'denshi manee de haraemasu ka', english: 'Can I pay with e-money?' },
    { id: 'ko-8', script: '現金で払います。', pronunciation: 'genkin de haraimasu', english: "I'll pay in cash." },
    { id: 'ko-9', script: 'ポイントカードは持っていません。', pronunciation: 'pointo kaado wa motte imasen', english: "I don't have a point card." },
    { id: 'ko-10', script: 'お箸をください。', pronunciation: 'ohashi o kudasai', english: 'Please give me chopsticks.' },
  ],
};

export default function KonbiniGuidePage({
  onGoHome,
  onOpenProfile,
  selectedLanguage,
}: KonbiniGuidePageProps) {
  if (normalizeLanguageId(selectedLanguage) !== 'ja') {
    return <Navigate to="/travel" replace />;
  }

  return (
    <TravelSectionPage
      section={KONBINI_SECTION}
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      selectedLanguage={selectedLanguage}
    />
  );
}
