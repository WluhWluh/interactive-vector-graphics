import { runAssetCapabilityUnitTests } from "./assets-capabilities.test";
import { runContractUnitTests } from "./contracts.test";
import { runDocumentMigrationUnitTests } from "./document-migration.test";
import { runEditorV2LayoutUnitTests } from "./editor-v2-layout.test";
import { runPrefabPosePropertyUnitTests } from "./prefab-pose-properties.test";
import { runViewMorphBillboardRendererUnitTests } from "./view-morph-billboard-renderer.test";
import { runViewMorphProfileUnitTests } from "./view-morph-profile.test";

runAssetCapabilityUnitTests();
runContractUnitTests();
runEditorV2LayoutUnitTests();
runPrefabPosePropertyUnitTests();
runDocumentMigrationUnitTests();
runViewMorphProfileUnitTests();
runViewMorphBillboardRendererUnitTests();
