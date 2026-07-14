# Setting this up on GitHub Pages

1. Create a new repo on GitHub. If you want the site at `https://<username>.github.io/`,
   name the repo exactly `<username>.github.io`. If you'd rather it live at a sub-path
   like `https://<username>.github.io/toolbox`, name it `toolbox` instead — no other
   changes needed, the links inside `index.html` are all relative.

2. Unzip this folder locally, then from inside it:

   ```bash
   git init
   git add .
   git commit -m "Initial site with factory siting + recipe impact tools"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```

3. On GitHub: go to the repo's **Settings → Pages**, set Source to the `main` branch,
   root folder (`/`), and save. Give it a minute or two — your site will be live at
   the URL GitHub shows you there.

## Adding a new tool later

1. Make a new folder at the repo root, e.g. `carbon-sequestration/`, and put that
   tool's `index.html` inside it.
2. Add a new `<a class="card">` block in the top-level `index.html`, copying the
   pattern of the existing two cards (swap the `href`, tag, title, and description).
3. Commit and push — GitHub Pages redeploys automatically.
