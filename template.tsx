import Providers from "./providers";
export default function Template({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
