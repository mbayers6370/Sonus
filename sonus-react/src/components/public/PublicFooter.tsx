import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="bg-[#1F2A37] px-4 py-8 backdrop-blur-[1px] sm:px-8 sm:py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <nav
          aria-label="Footer"
          className="font-mono flex flex-wrap items-center justify-center gap-2 text-[0.66rem] tracking-[0.02em] text-[#C7D0DC] sm:text-xs"
        >
          <Link className="underline-offset-2 hover:underline" to="/privacy">
            Privacy
          </Link>
          <span aria-hidden="true">|</span>
          <Link className="underline-offset-2 hover:underline" to="/terms">
            Terms
          </Link>
          <span aria-hidden="true">|</span>
          <Link className="underline-offset-2 hover:underline" to="/contact">
            Contact
          </Link>
          <span aria-hidden="true">|</span>
          <Link className="underline-offset-2 hover:underline" to="/attributions">
            Attributions
          </Link>
          <span aria-hidden="true">|</span>
          <span>© {new Date().getFullYear()} Sonus</span>
        </nav>
      </div>
    </footer>
  );
}
