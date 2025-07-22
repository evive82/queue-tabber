QueueTabber for MTurk
----------------------

Firefox extension for queueing HITs and maintaining multiple tabs for HITs in queue, so you can work without having to wait for HITs to load.

![Image](./icons/icon-enabled-96.png)

--------------------------

### Installation:

- Download the latest *.xpi* file from [Releases](https://github.com/evive82/queue-tabber/releases)
- Navigate to **about:addons** (or press **Ctrl+Shift+A**) in Firefox
- Click on the gear to the right of **Manage Your Extensions**
- Select **Install Add-on From File** and choose the *.xpi* file that you downloaded
- Pin the extension to the toolbar.

--------------------------

### Usage:
QueueTabber is essentially made up of two separate parts, which can be operated *mostly* independently: the Catcher and the Tabber.

#### Catcher:
The Catcher catches HITs using a group ID that has been entered in the **Group ID** box in the settings.
- A link to a HIT can also be pasted into the **Group ID** box and it should be able to convert the link to an ID.
- The **Maximum number of HITs in queue** setting can be used to, shockingly, set the maximum number of HITs that you would like to keep in queue. The Catcher should stop catching HITs when the queue reaches this count, and will only start again when a HIT is removed from queue.
- The **Refresh rate** setting adjusts how often you would like the Catcher to attempt catching new HITs. Note: this setting also affects the rate at which the Tabber opens new tabs.

#### Tabber:
The Tabber maintains a set number of open tabs for HITs in queue, and cycles through them as you work. When a HIT is submitted (or returned), that tab will close, focus will shift to the next tab to the right (the next HIT in queue), and a new tab will open at the far end of the managed tabs. This will continue until your queue is empty, or you disable the Tabber.
- The **Number of tabs to maintain** setting adjusts the number of tabs that you would like the Tabber to attempt to keep open.
- As mentioned above, the **Refresh rate** setting affects the rate at which the Tabber opens new tabs. Due to how the Catcher works and how the queue is managed, I think they just work better when they're in sync.
- The Tabber can be operated without the Catcher, if you prefer to catch HITs with something else.

#### Some extra notes/tips:
- It is recommended that you *pin* the extension to the browser toolbar, as everything is managed through the popup settings when you click the extension icon.
- When the Catcher is running, QueueTabber attempts to keep an up to date record of what's in queue based on HITs being caught and HITs being submitted. There is a periodic check of the queue to ensure that that record is staying in sync with the queue on MTurk. This check interval can be controlled with the **Queue check rate** setting. The default is 15 seconds, which should be fine most of the time. However, if you're running the Tabber without the Catcher, and you're working on a batch that is being heavily throttled or you're submitting HITs faster than new tabs can open, it may help to lower this setting.
- If you get a captcha, QueueTabber will not open any new tabs until that captcha is cleared. If the captcha pops up in a tab that is not currently focused, an alert sound will play.
- The version display at the bottom of the settings window links to the changelog, so you can see what's new.