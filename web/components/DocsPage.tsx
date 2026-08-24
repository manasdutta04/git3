"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Navbar } from "@/components/brutalist/navbar";
import { Footer } from "@/components/brutalist/footer";
import {
  GITHUB_REPO,
  INSTALL_DB,
  SERVE_CMD,
  STUDIO_CMD,
  STUDIO_CMD_LATEST,
} from "@/lib/nav";

export function DocsPage() {
  useEffect(() => {
    document.body.classList.add("is-landing");
    return () => document.body.classList.remove("is-landing");
  }, []);

  return (
    <div className="min-h-screen dot-grid-bg">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-12">
        <p className="mb-4 text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground">
          {"// DOCS"}
        </p>
        <h1 className="mb-4 font-mono text-3xl font-bold uppercase tracking-tight">
          git3 docs
        </h1>
        <p className="mb-10 text-sm font-mono text-muted-foreground leading-relaxed">
          Marketing lives on Vercel. The product runs locally via npm.
        </p>

        <section className="mb-12 border-2 border-foreground">
          <div className="border-b-2 border-foreground px-5 py-3">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground">
              01 · Studio
            </span>
          </div>
          <div className="space-y-4 px-5 py-5 text-sm font-mono text-muted-foreground leading-relaxed">
            <p>
              Open the local Studio UI (same visual language as this site):
            </p>
            <pre className="overflow-x-auto border-2 border-foreground bg-foreground p-4 text-xs text-background">
              {STUDIO_CMD}
            </pre>
            <p>
              Browser opens at{" "}
              <code className="text-foreground">http://localhost:3847</code>.
              Paste a GitHub token with <code className="text-foreground">repo</code>{" "}
              scope, your username, and a private repo name. Connect writes a
              local <code className="text-foreground">.env</code> — the token
              never leaves your machine.
            </p>
            <p>Force the latest Studio binary:</p>
            <pre className="overflow-x-auto border-2 border-foreground bg-foreground p-4 text-xs text-background">
              {STUDIO_CMD_LATEST}
            </pre>
          </div>
        </section>

        <section className="mb-12 border-2 border-foreground">
          <div className="border-b-2 border-foreground px-5 py-3">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground">
              02 · SDK
            </span>
          </div>
          <div className="space-y-4 px-5 py-5 text-sm font-mono text-muted-foreground leading-relaxed">
            <pre className="overflow-x-auto border-2 border-foreground bg-foreground p-4 text-xs text-background">
              {INSTALL_DB}
            </pre>
            <pre className="overflow-x-auto border-2 border-foreground bg-background p-4 text-xs text-foreground">{`import { Git3 } from '@git3db/db';

const db = new Git3();
const users = db.collection('users');

await users.add({ name: 'Ada', email: 'ada@example.com' });
const found = await users.findOne({ email: 'ada@example.com' });
await users.set(found!._id, { plan: 'pro' });
await users.remove(found!._id);`}</pre>
          </div>
        </section>

        <section className="mb-12 border-2 border-foreground">
          <div className="border-b-2 border-foreground px-5 py-3">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground">
              03 · Serve
            </span>
          </div>
          <div className="space-y-4 px-5 py-5 text-sm font-mono text-muted-foreground leading-relaxed">
            <p>
              API-only server for local HTML / apps (CORS limited to localhost):
            </p>
            <pre className="overflow-x-auto border-2 border-foreground bg-foreground p-4 text-xs text-background">
              {SERVE_CMD}
            </pre>
            <p>
              Default:{" "}
              <code className="text-foreground">http://127.0.0.1:3850</code>
            </p>
          </div>
        </section>

        <p className="text-xs font-mono text-muted-foreground">
          Full source:{" "}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="text-[#ea580c] hover:underline"
          >
            {GITHUB_REPO.replace("https://", "")}
          </a>
          {" · "}
          <Link href="/" className="text-foreground hover:underline">
            Back home
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
