export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>
            Comrades Marathon Explorer — Data from{" "}
            <a
              href="https://comrades.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-comrades hover:underline"
            >
              comrades.com
            </a>
          </p>
          <p>
            Covering {new Date().getFullYear() - 1921 + 1} years of the ultimate human race
          </p>
        </div>
      </div>
    </footer>
  );
}
