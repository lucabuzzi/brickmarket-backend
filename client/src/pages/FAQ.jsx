import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 0',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '1.1rem',
          fontWeight: '600',
        }}
      >
        <span>{question}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      <div
        style={{
          maxHeight: isOpen ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-out, padding 0.3s ease',
          paddingBottom: isOpen ? '1.25rem' : '0',
          color: 'var(--muted)',
          lineHeight: '1.6',
        }}
      >
        {answer}
      </div>
    </div>
  );
};

export default function FAQ() {
  const faqs = [
    {
      question: "Who can use the marketplace?",
      answer: "All adults can register. You can create an account as a buyer, a seller, or both."
    },
    {
      question: "Can I sell only original LEGO sets?",
      answer: "The marketplace is primarily designed for original LEGO products. Any compatible products must be clearly labeled as such in the description."
    },
    {
      question: "How do auctions work?",
      answer: "The seller sets a starting price and a duration. Buyers place binding bids. When the auction expires, the highest bidder wins, provided the reserve price (if any) is met."
    },
    {
      question: "What is a reserve price?",
      answer: "It is the minimum amount the seller is willing to accept. If bids do not reach this amount, the item will not be sold."
    },
    {
      question: "Can I use 'Buy It Now'?",
      answer: "If the seller enables it, you can purchase the product immediately at the indicated price, closing the auction."
    },
    {
      question: "How do payments work?",
      answer: "Payments are handled through secure methods supported by the platform (e.g., Stripe, PayPal)."
    },
    {
      question: "Does the marketplace charge a commission?",
      answer: "Yes, a commission is deducted from each sale, which is visible to the seller before publishing the listing."
    },
    {
      question: "Who handles shipping?",
      answer: "Shipping is the seller's responsibility. The buyer will receive tracking information, if available."
    },
    {
      question: "What should I do if the product arrives damaged?",
      answer: "Contact the seller immediately through the platform. If you cannot reach an agreement, you can open a dispute in the 'Support' section."
    },
    {
      question: "Can I leave a review?",
      answer: "Yes, after every transaction, you can leave a truthful and respectful review of the seller."
    },
    {
      question: "Can I have multiple accounts?",
      answer: "No, creating multiple accounts to bypass rules or manipulate auctions/reviews is not allowed."
    },
    {
      question: "How is my personal data handled?",
      answer: "Your data is processed according to the Privacy Policy available on the site, in compliance with current regulations."
    }
  ];

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '2.5rem', textAlign: 'center' }}>FAQ – Domande frequenti</h2>
      
      <div style={{ marginBottom: '3rem' }}>
        {faqs.map((faq, index) => (
          <FAQItem key={index} question={faq.question} answer={faq.answer} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
        <Link 
          to="/" 
          className="btn btn--primary"
          style={{ 
            padding: '0.75rem 2rem', 
            fontSize: '1rem', 
            fontWeight: 'bold',
            borderRadius: '12px',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
