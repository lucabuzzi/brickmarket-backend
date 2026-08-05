import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const faqs = [
    { question: t('faq.q1_question'), answer: t('faq.q1_answer') },
    { question: t('faq.q2_question'), answer: t('faq.q2_answer') },
    { question: t('faq.q3_question'), answer: t('faq.q3_answer') },
    { question: t('faq.q4_question'), answer: t('faq.q4_answer') },
    { question: t('faq.q5_question'), answer: t('faq.q5_answer') },
    { question: t('faq.q6_question'), answer: t('faq.q6_answer') },
    { question: t('faq.q7_question'), answer: t('faq.q7_answer') },
    { question: t('faq.q8_question'), answer: t('faq.q8_answer') },
    { question: t('faq.q9_question'), answer: t('faq.q9_answer') },
    { question: t('faq.q10_question'), answer: t('faq.q10_answer') },
    { question: t('faq.q11_question'), answer: t('faq.q11_answer') },
    { question: t('faq.q12_question'), answer: t('faq.q12_answer') },
  ];

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '2.5rem', textAlign: 'center' }}>{t('faq.title')}</h2>

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
          {t('ui.back_to_home')}
        </Link>
      </div>
    </div>
  );
}
