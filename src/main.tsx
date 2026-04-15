import { createRoot } from "react-dom/client";
import { StrictMode, type ReactNode } from "react";
import { hasRequiredFrontendEnv, missingFrontendEnvKeys } from "./config/env";
import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
	throw new Error("Missing #root element");
}

const root = createRoot(rootEl);

function SetupErrorScreen({ missingKeys }: { missingKeys: string[] }) {
	return (
		<div className="min-h-screen bg-background px-6 py-12 text-foreground">
			<div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
				<h1 className="mb-3 text-2xl font-semibold">Configuration Required</h1>
				<p className="mb-4 text-sm text-muted-foreground">
					The app cannot start because required frontend environment variables are missing.
				</p>
				<ul className="mb-5 list-disc space-y-1 pl-5 text-sm">
					{missingKeys.map((key) => (
						<li key={key}>
							<code>{key}</code>
						</li>
					))}
				</ul>
				<p className="text-sm text-muted-foreground">
					Create a <code>.env</code> file in the project root using <code>.env.example</code> as a guide,
					then restart the dev server.
				</p>
			</div>
		</div>
	);
}

async function bootstrap() {
	if (!hasRequiredFrontendEnv) {
		root.render(
			<StrictMode>
				<SetupErrorScreen missingKeys={missingFrontendEnvKeys} />
			</StrictMode>,
		);
		return;
	}

	const { default: App } = await import("./App.tsx");

	root.render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}

bootstrap().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "Unknown startup error";
	const fallback: ReactNode = (
		<div className="min-h-screen bg-background px-6 py-12 text-foreground">
			<div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
				<h1 className="mb-3 text-2xl font-semibold">Startup Error</h1>
				<p className="text-sm text-muted-foreground">{message}</p>
			</div>
		</div>
	);

	root.render(<StrictMode>{fallback}</StrictMode>);
});
