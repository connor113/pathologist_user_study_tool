"""Execute the companion in-process without Jupyter connection files or sockets.

The normal nbconvert launcher could not set Windows ACLs on its temporary kernel
connection file in this sandbox. This uses the same Python environment and
IPython cell execution, records genuine cell outputs, and changes no permissions.
"""
from pathlib import Path
import os

import nbformat
from IPython.core.interactiveshell import InteractiveShell
from IPython.utils.capture import capture_output
from traitlets.config import Config

out = Path(__file__).resolve().parent
path = out / "comparison-and-q1.ipynb"
nb = nbformat.read(path, as_version=4)
shell = InteractiveShell.instance(config=Config({"HistoryManager": {"hist_file": ":memory:"}}))
prior_cwd = Path.cwd()
try:
    os.chdir(out)
    for cell in nb.cells:
        if cell.cell_type != "code":
            continue
        execution_count = shell.execution_count
        with capture_output() as captured:
            result = shell.run_cell(cell.source, store_history=True)
        if result.error_before_exec or result.error_in_exec:
            raise RuntimeError(captured.stdout + captured.stderr) from (result.error_before_exec or result.error_in_exec)
        cell.execution_count = execution_count
        cell.outputs = []
        for name, value in [("stdout", captured.stdout), ("stderr", captured.stderr)]:
            if value:
                cell.outputs.append(nbformat.v4.new_output("stream", name=name, text=value))
        for value in captured.outputs:
            cell.outputs.append(nbformat.v4.new_output("display_data", data=value.data, metadata=value.metadata))
        print(f"Cell {execution_count} passed")
    nb.metadata["execution_receipt"] = {
        "method": "In-process IPython InteractiveShell; no kernel connection file or socket",
        "executor": "execute_companion.py",
        "reason": "nbconvert kernel launcher could not set Windows ACLs in the sandbox",
    }
    nbformat.validate(nb)
    nbformat.write(nb, path)
finally:
    os.chdir(prior_cwd)
print("Companion executed and outputs saved")
