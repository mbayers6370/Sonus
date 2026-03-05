import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer className="bg-[#1F2A37] px-4 py-8 backdrop-blur-[1px] sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#D6E2EE] sm:text-base"
        >
          <Link className="underline-offset-4 hover:underline" to="/privacy">
            Privacy Policy
          </Link>
          <Link className="underline-offset-4 hover:underline" to="/terms">
            Terms of Service
          </Link>
          <Link className="underline-offset-4 hover:underline" to="/contact">
            Contact
          </Link>
        </nav>
        <p className="text-center text-xs tracking-wide text-[#9CB4CB] sm:text-sm">© {new Date().getFullYear()} Sonus</p>
      </div>
    </footer>
  );
}
