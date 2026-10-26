"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ApiError, importProfile } from "@/lib/api";
import type { Profile } from "@/lib/profile";

export function ImportButton({
  onImported,
  onError,
  children = "Importer un profile.yaml",
  ...props
}: {
  onImported: (profile: Profile) => void;
  onError: (error: ApiError) => void;
} & Omit<ButtonProps, "onClick" | "onError">) {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".yaml,.yml,application/yaml,text/yaml"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setLoading(true);
          try {
            onImported(await importProfile(await file.text()));
          } catch (error) {
            onError(error instanceof ApiError ? error : new ApiError("Import impossible.", 0));
          } finally {
            setLoading(false);
          }
        }}
      />
      <Button {...props} loading={loading} onClick={() => input.current?.click()}>
        <Upload aria-hidden />
        {children}
      </Button>
    </>
  );
}
