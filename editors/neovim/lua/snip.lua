-- editors/neovim/lua/snip.lua
-- Neovim plugin integration for snip CLI snippet manager.

local M = {}

-- Helper function to execute shell commands and capture output
local function run_cmd(cmd)
  local handle = io.popen(cmd)
  if not handle then return "" end
  local result = handle:read("*a")
  handle:close()
  return result
end

-- Save visual selection as a snippet
function M.add_selection()
  -- Get start and end lines of visual selection
  local start_line = vim.fn.line("'<")
  local end_line = vim.fn.line("'>")
  local lines = vim.fn.getline(start_line, end_line)
  local selection = table.concat(lines, "\n")

  if selection == "" then
    vim.notify("Snip: No text selected", vim.log.levels.WARN)
    return
  end

  -- Prompt user for snippet name
  vim.ui.input({ prompt = "Snippet Name: " }, function(name)
    if not name or name == "" then return end
    
    -- Prompt user for language, defaulting to current buffer's filetype
    local ft = vim.bo.filetype
    vim.ui.input({ prompt = "Language: ", default = ft }, function(lang)
      -- Write visual selection to a temp file to pipe it into the CLI
      local temp_file = os.tmpname()
      local f = io.open(temp_file, "w")
      if not f then
        vim.notify("Snip: Failed to create temp file", vim.log.levels.ERROR)
        return
      end
      f:write(selection)
      f:close()

      local cmd = string.format("snip add %s --lang %s < %s", vim.fn.shellescape(name), vim.fn.shellescape(lang or ""), vim.fn.shellescape(temp_file))
      local output = run_cmd(cmd)
      os.remove(temp_file)

      vim.notify("Snip: Added snippet '" .. name .. "' successfully!", vim.log.levels.INFO)
    end)
  end)
end

-- Search and run a snippet inside a Neovim terminal split
function M.run_snippet()
  -- Fetch snippets as JSON from CLI
  local output = run_cmd("snip list --json")
  local ok, snippets = pcall(vim.json.decode, output)
  if not ok or not snippets or #snippets == 0 then
    vim.notify("Snip: No snippets found or CLI execution failed", vim.log.levels.WARN)
    return
  end

  local options = {}
  local snippet_map = {}
  for _, s in ipairs(snippets) do
    local label = string.format("%s [%s]", s.name, s.language or "text")
    table.insert(options, label)
    snippet_map[label] = s
  end

  -- Open interactive fuzzy selection
  vim.ui.select(options, {
    prompt = "Select snippet to run:",
    format_item = function(item) return item end,
  }, function(choice)
    if not choice then return end
    local s = snippet_map[choice]
    
    local cmd = string.format("snip run %s", vim.fn.shellescape(s.name))
    vim.notify("Snip: Running '" .. s.name .. "' in terminal split...", vim.log.levels.INFO)
    
    -- Open terminal split and run snippet
    vim.cmd("split | terminal " .. cmd)
  end)
end

-- Initialize plugin commands
function M.setup()
  vim.api.nvim_create_user_command("SnipAdd", function()
    M.add_selection()
  end, { range = true })

  vim.api.nvim_create_user_command("SnipRun", function()
    M.run_snippet()
  end, {})
end

return M
