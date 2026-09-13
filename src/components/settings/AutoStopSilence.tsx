import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Slider } from "../ui/Slider";
import { useSettings } from "../../hooks/useSettings";

interface AutoStopSilenceProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AutoStopSilence: React.FC<AutoStopSilenceProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("auto_stop_silence_enabled") ?? false;
    const durationMs = getSetting("auto_stop_silence_duration_ms") ?? 3000;
    const durationSec = Math.round(durationMs / 1000);

    return (
      <div className="space-y-3">
        <ToggleSwitch
          checked={enabled}
          onChange={(enabled) =>
            updateSetting("auto_stop_silence_enabled", enabled)
          }
          isUpdating={isUpdating("auto_stop_silence_enabled")}
          label={t("settings.advanced.autoStopSilence.title")}
          description={t("settings.advanced.autoStopSilence.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        />
        {enabled && (
          <Slider
            value={durationSec}
            onChange={(val) =>
              updateSetting("auto_stop_silence_duration_ms", val * 1000)
            }
            min={1}
            max={10}
            step={1}
            label={t("settings.advanced.autoStopSilence.durationTitle")}
            description={t(
              "settings.advanced.autoStopSilence.durationDescription",
            )}
            descriptionMode={descriptionMode}
            grouped={grouped}
            formatValue={(v) => `${v}s`}
          />
        )}
      </div>
    );
  },
);
