import { Component } from "react";
import PropTypes from "prop-types";

const glitch = (text) => (
  <span className="relative inline-block">
    <span className="absolute inset-0 text-cyan-400 animate-pulse" style={{ clipPath: "inset(20% 0 60% 0)", transform: "translate(-2px, -2px)", opacity: 0.8 }}>{text}</span>
    <span className="absolute inset-0 text-pink-500 animate-pulse" style={{ clipPath: "inset(60% 0 10% 0)", transform: "translate(2px, 2px)", opacity: 0.8 }}>{text}</span>
    <span className="relative">{text}</span>
  </span>
);

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-space-900 px-4 relative overflow-hidden">
          <div className="cyber-bg absolute inset-0" />
          <div className="orb-cyan cyper-orb" />
          <div className="max-w-md w-full relative z-10">
            <div className="neon-border-cyan rounded-xl overflow-hidden">
              <div className="bg-gray-900/80 backdrop-blur-xl p-8 text-center border border-red-500/20">
                <div className="mb-4 text-6xl relative inline-block">
                  {glitch("⚠")}
                </div>
                <h1 className="text-2xl font-bold text-gradient-flow mb-2">
                  SYSTEM ERROR
                </h1>
                <p className="text-sm text-gray-400 mb-4 font-mono">
                  [CRITICAL_FAILURE] — An unexpected exception occurred in the application layer.
                </p>

                {this.state.error && (
                  <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/20 p-3 text-left">
                    <p className="text-xs font-mono text-red-300 break-words">
                      {this.state.error.toString()}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 justify-center mt-6">
                  <button
                    onClick={this.handleReset}
                    className="cyber-btn relative rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition"
                  >
                    REBOOT
                  </button>
                  <button
                    onClick={() => window.location.href = "/"}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-cyan-500/30 hover:text-cyan-400"
                  >
                    Return to Home
                  </button>
                </div>

                <p className="text-[10px] text-gray-600 mt-4 font-mono">
                  ERR_ID: {Date.now().toString(16).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
