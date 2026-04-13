type DavlosLogoProps = {
  className?: string;
};

export function DavlosLogo({ className }: DavlosLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M33.7 4.8C31.4 10.4 29.4 13.8 26.5 17.5C22.6 22.2 20.7 26.4 20.7 31.6C20.7 36.1 22.2 39.9 25 43.5C22.4 37.6 22.8 32.7 24.9 28.4C26.8 24.4 30.1 21.2 32.9 17C35.1 13.7 36.6 10.2 33.7 4.8Z"
        fill="currentColor"
      />
      <path
        d="M34.2 9.9C34.2 16.1 36.1 19.6 39 23.4C42.8 28.3 45.7 32.7 45.7 38.8C45.7 42.8 44.5 46.5 41.9 49.6C43.6 45 43.7 40.9 42.6 37.1C41.3 32.5 38.3 29.2 35.3 25.3C32.5 21.7 30.2 17.8 34.2 9.9Z"
        fill="currentColor"
      />
      <path
        d="M27.5 18.9C30.6 23.6 32.1 26.8 32.1 30.6C32.1 34.2 30.7 37.2 27.6 40.1C24.8 37.6 23.3 34.7 23.3 31.2C23.3 27.8 24.5 24.8 27.5 18.9Z"
        fill="#E8913A"
      />
      <path
        d="M24.6 42H39.4L41.5 46.7H22.5L24.6 42Z"
        fill="currentColor"
      />
      <path
        d="M15.2 47.9H48.8C48.8 52 45.5 55.3 41.4 55.3H22.6C18.5 55.3 15.2 52 15.2 47.9Z"
        fill="currentColor"
      />
      <path
        d="M28.6 55.3H35.4L39.4 61.4C40.3 62.8 39.3 64 37.7 64H26.3C24.7 64 23.7 62.8 24.6 61.4L28.6 55.3Z"
        fill="currentColor"
      />
      <path
        d="M29.8 29.5L25.5 61.7C25.3 63 26.3 64 27.5 64H36.5C37.7 64 38.7 63 38.5 61.7L34.2 29.5H29.8Z"
        fill="currentColor"
      />
      <path
        d="M28.6 29.7H35.4"
        stroke="#E8913A"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
