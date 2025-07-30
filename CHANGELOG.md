# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

- Extension icon should now properly reset to idle when logged out.
- Tabs with expiring HITs now close a little closer to the actual expiration time.

## [1.0.3] - 2025-07-21

### Added

- Group ID input now saves up to three previous group IDs.
- Add changelog link to version label in popup.

### Changed

- Mario should be less excited about captchas when they occur in the focused tab.
- Popup UI has been resized to make it easier to find previous group IDs in history.

## [1.0.2] - 2025-07-17

### Added

- Add version number to popup.

### Changed

- Extension icon now updates to indicate whether the extension is running or not.
- Slider labels in popup controls have been changed to be more on brand.

### Fixed

- Tabs containing a captcha now automatically close after completion.
- Tabs now automatically close when their HIT expires.

## [1.0.1] - 2025-07-15

### Added

- First tab opened when queue starts to fill should now be focused.

### Fixed

- Fix invalid variable names when clearing intervals.
