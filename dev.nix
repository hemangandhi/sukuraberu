# Nix packages version of "the set of things you need in your system to code
# this"

with import <nixpkgs> {};

stdenv.mkDerivation {
  name = "sukuraberu-dev-env";
  buildInputs = [
    # ng editor
    emacs26Packages.ng2-mode
    # JS deps
    nodejs-12_x
    yarn
    nodePackages."@angular/cli"
    # Python
    python
  ];
}
