import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, Copy, ExternalLink } from "lucide-react";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { SettingContainer } from "../../ui/SettingContainer";
import { Button } from "../../ui/Button";
import { AppDataDirectory } from "../AppDataDirectory";
import { AppLanguageSelector } from "../AppLanguageSelector";
import { ShowWhatsNewOnUpdate } from "../ShowWhatsNewOnUpdate";
import { ThemeSelector } from "../ThemeSelector";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { LogDirectory } from "../debug";
import { commands } from "@/bindings";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";

const TITLE_LIMIT = 120;
const DESCRIPTION_LIMIT = 1500;
const GITHUB_ISSUES_URL = "https://github.com/cjpais/Handy/issues";
const SUPPORT_EMAIL = "contact@handy.computer";

type SubmitTarget = "github" | "email";

interface ReportContents {
  title: string;
  urlBody: string;
  fullMarkdown: string;
}

export const AboutSettings: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const [isReportBugOpen, setIsReportBugOpen] = useState(false);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [includeLogs, setIncludeLogs] = useState(false);
  const [submitMethod, setSubmitMethod] = useState<SubmitTarget>("github");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("");
      }
    };

    fetchVersion();
  }, []);

  const handleDonateClick = async () => {
    try {
      await openUrl("https://handy.computer/donate");
    } catch (error) {
      console.error("Failed to open donate link:", error);
    }
  };

  const handleReportBugClick = () => {
    setBugTitle("");
    setBugDescription("");
    setIncludeLogs(false);
    setSubmitMethod("github");
    setSubmitError(null);
    setCopyState("idle");
    setIsReportBugOpen(true);
  };

  const handleIncludeLogsChange = (checked: boolean) => {
    setIncludeLogs(checked);
    // Smart routing: logs stay private, so recommend email.
    // GitHub stays available (report goes without logs, logs via clipboard).
    setSubmitMethod(checked ? "email" : "github");
  };

  const buildReportContents = async (): Promise<ReportContents> => {
    let sysDetails = {
      os_version: "Unknown OS",
      cpu_model: "Unknown CPU",
      gpu_model: "Unknown GPU",
    };
    try {
      sysDetails = await commands.getSystemDetails();
    } catch (error) {
      console.error("Failed to get system details:", error);
    }

    let logsText = "";
    if (includeLogs) {
      try {
        const logsResult = await commands.readRecentLogs();
        if (logsResult.status === "error") {
          throw new Error(t("settings.about.reportBug.logsFailed"));
        }
        logsText = logsResult.data;
        if (!logsText.trim()) {
          throw new Error(t("settings.about.reportBug.noLogsAvailable"));
        }
      } catch (error) {
        if (error instanceof Error) throw error;
        console.error("Failed to read logs:", error);
        throw new Error(t("settings.about.reportBug.logsFailed"));
      }
    }

    const urlBody = `## ${t("settings.about.reportBug.issueTemplate.beforeSubmit")}

**${t("settings.about.reportBug.issueTemplate.searchExisting")}** ${t("settings.about.reportBug.issueTemplate.maintainerNote")}

## ${t("settings.about.reportBug.issueTemplate.description")}

${bugDescription}

## ${t("settings.about.reportBug.issueTemplate.systemInformation")}

**${t("settings.about.reportBug.issueTemplate.appVersion")}:** ${version || t("settings.about.reportBug.issueTemplate.unknownVersion")}

<!-- ${t("settings.about.reportBug.issueTemplate.appVersionHint")} -->

**${t("settings.about.reportBug.issueTemplate.operatingSystem")}:** ${sysDetails.os_version}

<!-- ${t("settings.about.reportBug.issueTemplate.operatingSystemHint")} -->

**${t("settings.about.reportBug.issueTemplate.cpu")}:** ${sysDetails.cpu_model}

<!-- ${t("settings.about.reportBug.issueTemplate.cpuHint")} -->

**${t("settings.about.reportBug.issueTemplate.gpu")}:** ${sysDetails.gpu_model}

<!-- ${t("settings.about.reportBug.issueTemplate.gpuHint")} -->

## ${t("settings.about.reportBug.issueTemplate.logs")}

<!-- ${t("settings.about.reportBug.issueTemplate.logsHint")} -->${
      includeLogs
        ? `

> ${t("settings.about.reportBug.logsInstruction")}`
        : ""
    }`;

    // Logs never go inside the URL: mailto: and GitHub URLs truncate after
    // ~2KB while 100 log lines are easily 10-30KB. The full report (with
    // logs in a fenced block) travels via the clipboard instead.
    const fullMarkdown =
      includeLogs && logsText
        ? `${urlBody}\n\n\`\`\`log\n${logsText.trim()}\n\`\`\``
        : urlBody;

    const title = `[${t("settings.about.reportBug.issueTemplate.titlePrefix")}] ${bugTitle.trim()}`;
    return { title, urlBody, fullMarkdown };
  };

  const copyFullReport = async (): Promise<boolean> => {
    try {
      const { fullMarkdown } = await buildReportContents();
      await navigator.clipboard.writeText(fullMarkdown);
      setCopyState("copied");
      return true;
    } catch (error) {
      console.error("Failed to copy bug report:", error);
      setCopyState("failed");
      if (error instanceof Error) setSubmitError(error.message);
      else setSubmitError(t("settings.about.reportBug.copyFailed"));
      return false;
    }
  };

  const handleFormSubmit = async (target: SubmitTarget) => {
    setSubmitError(null);
    setCopyState("idle");
    setIsSubmitting(true);
    try {
      const { title, urlBody, fullMarkdown } = await buildReportContents();

      if (includeLogs) {
        // Put the full report (incl. logs) on the clipboard first, then open
        // a short URL that references it. Never embed logs in the URL itself.
        try {
          await navigator.clipboard.writeText(fullMarkdown);
          setCopyState("copied");
        } catch (error) {
          console.error("Failed to copy bug report:", error);
          setCopyState("failed");
          setSubmitError(t("settings.about.reportBug.copyFailed"));
          return;
        }
      }

      const destination =
        target === "email"
          ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(urlBody)}`
          : `https://github.com/cjpais/handy/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(urlBody)}`;
      await openUrl(destination);
      setIsReportBugOpen(false);
      setBugTitle("");
      setBugDescription("");
      setIncludeLogs(false);
      setSubmitMethod("github");
    } catch (error) {
      console.error("Failed to open bug report link:", error);
      if (error instanceof Error) setSubmitError(error.message);
      else
        setSubmitError(
          t("settings.about.reportBug.failed", { error: String(error) }),
        );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    bugTitle.trim().length > 0 &&
    bugDescription.trim().length > 0 &&
    !isSubmitting;

  const renderDestinationOption = (
    value: SubmitTarget,
    optionTitle: string,
    optionDescription: string,
  ) => {
    const selected = submitMethod === value;
    const recommended =
      (includeLogs && value === "email") ||
      (!includeLogs && value === "github");
    return (
      <label
        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors focus-within:ring-1 focus-within:ring-logo-primary ${
          selected
            ? "border-logo-primary bg-logo-primary/10"
            : "border-mid-gray/20 hover:border-logo-primary/50 hover:bg-logo-primary/5"
        } ${isSubmitting ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          type="radio"
          name="bug-report-destination"
          checked={selected}
          onChange={() => setSubmitMethod(value)}
          disabled={isSubmitting}
          className="mt-0.5 h-4 w-4 shrink-0 accent-logo-primary focus-visible:outline-none"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold text-text">
            {optionTitle}
            {recommended && (
              <span className="rounded-full bg-logo-primary/15 px-2 py-0.5 text-xs font-medium text-text">
                {t("settings.about.reportBug.recommended")}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-mid-gray">
            {optionDescription}
          </span>
        </span>
      </label>
    );
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.about.title")}>
        <AppLanguageSelector descriptionMode="tooltip" grouped={true} />
        <ThemeSelector descriptionMode="tooltip" grouped={true} />
        <SettingContainer
          title={t("settings.about.version.title")}
          description={t("settings.about.version.description")}
          grouped={true}
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="text-sm font-mono">v{version}</span>
        </SettingContainer>

        <ShowWhatsNewOnUpdate descriptionMode="tooltip" grouped={true} />

        <SettingContainer
          title={t("settings.about.supportDevelopment.title")}
          description={t("settings.about.supportDevelopment.description")}
          grouped={true}
        >
          <Button variant="primary" size="md" onClick={handleDonateClick}>
            {t("settings.about.supportDevelopment.button")}
          </Button>
        </SettingContainer>

        <SettingContainer
          title={t("settings.about.sourceCode.title")}
          description={t("settings.about.sourceCode.description")}
          grouped={true}
        >
          <Button
            variant="secondary"
            size="md"
            onClick={() => openUrl("https://github.com/cjpais/Handy")}
          >
            {t("settings.about.sourceCode.button")}
          </Button>
        </SettingContainer>

        <SettingContainer
          title={t("settings.about.reportBug.title")}
          description={t("settings.about.reportBug.description")}
          grouped={true}
        >
          <Button variant="primary" size="md" onClick={handleReportBugClick}>
            {t("settings.about.reportBug.button")}
          </Button>
        </SettingContainer>

        <AppDataDirectory descriptionMode="tooltip" grouped={true} />
        <LogDirectory grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.about.acknowledgments.title")}>
        <SettingContainer
          title={t("settings.about.acknowledgments.ggml.title")}
          description={t("settings.about.acknowledgments.ggml.description")}
          grouped={true}
          layout="stacked"
        >
          <div className="text-sm text-mid-gray">
            {t("settings.about.acknowledgments.ggml.details")}
          </div>
        </SettingContainer>
      </SettingsGroup>

      <Dialog
        open={isReportBugOpen}
        title={t("settings.about.reportBug.title")}
        description={t("settings.about.reportBug.dialogDescription")}
        closeLabel={t("common.cancel")}
        onOpenChange={setIsReportBugOpen}
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsReportBugOpen(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={copyFullReport}
              disabled={!canSubmit}
            >
              <span className="flex items-center gap-1.5">
                {copyState === "copied" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {t("settings.about.reportBug.copyReport")}
              </span>
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleFormSubmit(submitMethod)}
              disabled={!canSubmit}
            >
              {isSubmitting
                ? t("settings.about.reportBug.submitting")
                : submitMethod === "email"
                  ? t("settings.about.reportBug.openEmail")
                  : t("settings.about.reportBug.submit")}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-start">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-mid-gray/20 bg-mid-gray/5 p-3 text-sm text-mid-gray">
            <span>{t("settings.about.reportBug.searchPrompt")}</span>
            <button
              type="button"
              onClick={() => openUrl(GITHUB_ISSUES_URL)}
              className="inline-flex cursor-pointer items-center gap-1 rounded font-semibold text-logo-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-logo-primary"
            >
              {t("settings.about.reportBug.existingIssuesLink")}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span>{t("settings.about.reportBug.searchPromptSuffix")}</span>
          </div>

          <div className="flex flex-col space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="bug-report-title"
                className="text-xs font-semibold text-mid-gray uppercase tracking-wider"
              >
                {t("settings.about.reportBug.titleLabel")}
              </label>
              <span className="text-xs text-mid-gray" aria-hidden="true">
                {t("settings.about.reportBug.characterCount", {
                  count: bugTitle.length,
                  limit: TITLE_LIMIT,
                })}
              </span>
            </div>
            <Input
              id="bug-report-title"
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
              maxLength={TITLE_LIMIT}
              placeholder={t("settings.about.reportBug.titlePlaceholder")}
              className="w-full font-medium"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="bug-report-description"
                className="text-xs font-semibold text-mid-gray uppercase tracking-wider"
              >
                {t("settings.about.reportBug.descriptionLabel")}
              </label>
              <span className="text-xs text-mid-gray" aria-hidden="true">
                {t("settings.about.reportBug.characterCount", {
                  count: bugDescription.length,
                  limit: DESCRIPTION_LIMIT,
                })}
              </span>
            </div>
            <Textarea
              id="bug-report-description"
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
              maxLength={DESCRIPTION_LIMIT}
              placeholder={t("settings.about.reportBug.descriptionPlaceholder")}
              className="w-full min-h-[140px] font-medium"
              required
              disabled={isSubmitting}
            />
          </div>

          <ToggleSwitch
            checked={includeLogs}
            onChange={handleIncludeLogsChange}
            disabled={isSubmitting}
            label={t("settings.about.reportBug.includeLogs")}
            description={t("settings.about.reportBug.includeLogsDescription")}
          />

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              {t("settings.about.reportBug.submitMethod")}
            </legend>
            {renderDestinationOption(
              "github",
              t("settings.about.reportBug.githubOption"),
              t("settings.about.reportBug.githubDescription"),
            )}
            {renderDestinationOption(
              "email",
              t("settings.about.reportBug.emailOption"),
              t("settings.about.reportBug.emailDescription"),
            )}
          </fieldset>

          {includeLogs && (
            <p className="rounded-md border border-logo-primary/30 bg-logo-primary/10 p-3 text-sm text-mid-gray">
              {t("settings.about.reportBug.logsEmailOnly")}
            </p>
          )}

          {includeLogs && (
            <div
              role="alert"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <p className="font-semibold">
                {t("settings.about.reportBug.logsWarningTitle")}
              </p>
              <p className="mt-1 text-mid-gray">
                {t("settings.about.reportBug.logsWarning")}
              </p>
            </div>
          )}
          {copyState === "copied" && (
            <p
              role="status"
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-mid-gray"
            >
              {t("settings.about.reportBug.copied")}
            </p>
          )}
          {copyState === "failed" && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {t("settings.about.reportBug.copyFailed")}
            </p>
          )}
          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400"
            >
              {submitError}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
};
