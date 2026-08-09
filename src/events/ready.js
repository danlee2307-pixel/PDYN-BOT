import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import {
  reconcileTicketPanels,
  reconcileVerificationPanels,
  reconcileReactionRolePanelHealth,
} from "../services/panelHealthService.js";
import { reconcileLevelRoles } from "../services/leveling/levelRoleSyncService.js";
import { initRiffyAfterReady } from "../services/music/riffySetup.js";
import { startCRTMonitor } from "../services/crt/crtService.js";

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(
        `Ready! Logged in as ${client.user.tag}`
      );

      startupLog(
        `Serving ${client.guilds.cache.size} guild(s)`
      );

      startupLog(
        `Loaded ${client.commands.size} commands`
      );

      // ======================================================
      // CRT MONITOR
      // ======================================================

      if (client.config?.features?.crt) {
        startCRTMonitor(client);

        startupLog(
          "CRT monitor started."
        );
      }

      // ======================================================
      // MUSIC
      // ======================================================

      if (client.config?.features?.music) {
        initRiffyAfterReady(client);
      }

      // ======================================================
      // REACTION ROLES
      // ======================================================

      const reconciliationSummary =
        await reconcileReactionRoleMessages(client);

      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      // ======================================================
      // TICKET PANELS
      // ======================================================

      const ticketPanelSummary =
        await reconcileTicketPanels(client);

      startupLog(
        `Ticket panel health: scanned ${ticketPanelSummary.scannedGuilds} guilds, healthy ${ticketPanelSummary.healthyPanels}, deleted ${ticketPanelSummary.deletedPanels}, missing channel ${ticketPanelSummary.missingChannels}, recovered ${ticketPanelSummary.recoveredIds}, errors ${ticketPanelSummary.errors}`
      );

      // ======================================================
      // VERIFICATION PANELS
      // ======================================================

      const verificationPanelSummary =
        await reconcileVerificationPanels(client);

      startupLog(
        `Verification panel health: scanned ${verificationPanelSummary.scannedGuilds} guilds, healthy ${verificationPanelSummary.healthyPanels}, deleted ${verificationPanelSummary.deletedPanels}, missing channel ${verificationPanelSummary.missingChannels}, recovered ${verificationPanelSummary.recoveredIds}, errors ${verificationPanelSummary.errors}`
      );

      // ======================================================
      // REACTION ROLE PANEL HEALTH
      // ======================================================

      const reactionRolePanelSummary =
        await reconcileReactionRolePanelHealth(client);

      startupLog(
        `Reaction role panel health: scanned ${reactionRolePanelSummary.scannedPanels} panels, healthy ${reactionRolePanelSummary.healthyPanels}, deleted ${reactionRolePanelSummary.deletedPanels}, missing channel ${reactionRolePanelSummary.missingChannels}, recovered ${reactionRolePanelSummary.recoveredIds}, errors ${reactionRolePanelSummary.errors}`
      );

      // ======================================================
      // LEVEL ROLES
      // ======================================================

      const levelRoleSummary =
        await reconcileLevelRoles(client);

      startupLog(
        `Level role sync: scanned ${levelRoleSummary.scannedGuilds} guilds, pruned ${levelRoleSummary.prunedRewardEntries} stale rewards, re-awarded ${levelRoleSummary.rolesReAwarded} roles, errors ${levelRoleSummary.errors}`
      );

    } catch (error) {
      logger.error(
        "Error in ready event:",
        error
      );
    }
  },
};