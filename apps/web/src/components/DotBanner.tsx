import "./dot-banner.css";

export interface DotBannerProps {
  label: string;
  titleStrong: string;
  titleSoft: string;
  subtitle: string;
}

export function DotBanner({ label, titleStrong, titleSoft, subtitle }: DotBannerProps) {
  return (
    <div className="dot-banner">
      <div className="dot-banner__text" data-dot-clear>
        <p className="dot-banner__label">{label}</p>
        <h1 id="dot-banner-title" className="dot-banner__title">
          <span className="dot-banner__title-strong">{titleStrong}</span>{" "}
          {titleSoft ? <span className="dot-banner__title-soft">{titleSoft}</span> : null}
        </h1>
        <p className="dot-banner__subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
